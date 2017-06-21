'use strict';

const config = require('config');
const http = require('http');
const log4js = require('log4js');

const gethClient = require('./gethClient');
const elasticClient = require('./elasticClient');

const logger = log4js.getLogger('cmPa');
logger.setLevel(config.get('logging.level'));


var combinedParser = {

  init: function (config) {

  },

  batchRun: function (startBlock, endBlock) {
    loopOverBlocks(startBlock, endBlock, false);
  },

  follow: function () {
    follow();
  }

};

module.exports = combinedParser;


function follow() {
  elasticClient.getHighestBlockIndex(function (topIndex) {
    // topIndex == -1 if there are no blocks in the index
    loopOverBlocks(topIndex + 1, Infinity, true);
  })
}


function processTransactions(transactionCount, blockNumber, maxBlockNumber, blockTime, follow) {
  var recordedTransactions = 0;
  var transactions = [];
  var transactionIds = [];

  for (var transactionIndex = 0; transactionIndex < transactionCount; transactionIndex++) {

    (function (currTxIndex, blockTime) {

      var transactionQueryString = '{"jsonrpc":"2.0","method":"eth_getTransactionByBlockNumberAndIndex","params":["0x' + Number(blockNumber).toString(16) + '", "0x' + currTxIndex.toString(16) + '"],"id":1}';

      gethClient.post(transactionQueryString, function (gethResponse) {
        try {
          var parsedResponse = JSON.parse(gethResponse);

          if (parsedResponse.result === null) {
            logger.error("transactionQuery result was null");
            return;
          }

          transactions[currTxIndex] = parsedResponse.result;
          transactions[currTxIndex].timestamp = blockTime.getTime() + currTxIndex;
          transactionIds[currTxIndex] = blockNumber * 100000 + currTxIndex;
          recordedTransactions += 1;

          if (recordedTransactions === transactionCount) {
            elasticClient.postTransactions(transactions, transactionIds, function (elasticError, elasticResponse) {
              if (elasticError) {
                logger.error(elasticError);
              }
              if (elasticResponse && elasticResponse.errors) {
                logger.error(elasticResponse.errors);
              }

              logger.trace(elasticResponse);

              // we do not proceed to the next block unless we have seen all callbacks
              if (blockNumber < maxBlockNumber) {
                return loopOverBlocks(blockNumber + 1, maxBlockNumber, follow);
              }
            });  // end store transaction in ES
          }

        } catch (err) {
          logger.warn('There was an error parsing the response: ' + err);
        }
      });  // end get transactions
    })(transactionIndex, blockTime);
  }
}


function loopOverBlocks(blockNumber, maxBlockNumber, follow) {
  logger.info('*** Fetching block with number ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') ***');
  var blockQueryString = '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x' + Number(blockNumber).toString(16) + '", false],"id":1}';

  gethClient.post(blockQueryString, function (blockQueryResponse) {

    var parsedBlockQueryResponse = JSON.parse(blockQueryResponse);
    if (parsedBlockQueryResponse.result === null) {
      // we did not find any block; wait one block time and retry
      if (follow) {
        sleep(12000).then(function () {
          return loopOverBlocks(blockNumber, maxBlockNumber, follow)
        });
      } else {
        logger.warn('Block ' + blockNumber + ' (0x' + Number(blockNumber).toString(16) + ') does not seem to exist!');
        return null;
      }
    } else {
      elasticClient.postBlock(parsedBlockQueryResponse.result, blockNumber, function (elasticError, elasticResponse) {
        if (elasticError) {
          logger.error(elasticError);
        }
        logger.trace(elasticResponse);

        var transactionCount = parsedBlockQueryResponse.result.transactions.length;
        logger.info('Number of transactions: ' + transactionCount);

        if (transactionCount === 0) {
          // nothing to do for this block
          if (blockNumber < maxBlockNumber) {
            return loopOverBlocks(blockNumber + 1, maxBlockNumber, follow);
          }
          return null;
        }
        var blockTime = parsedBlockQueryResponse.result.timestamp;
        processTransactions(transactionCount, blockNumber, maxBlockNumber, blockTime, follow);
      });  // end store block in ES

    }
  });
}


function sleep(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
}