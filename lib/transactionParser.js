'use strict';

const config = require('config');
const http = require('http');
const log4js = require('log4js');

const gethClient = require('./gethClient');
const elasticClient = require('./elasticClient');

const logger = log4js.getLogger('txPa');
logger.setLevel(config.get('logging.level'));


var blockParser = {

  init: function (config) {

  },

  batchRun: function (startBlock, endBlock) {
    loopOverBlocks(startBlock, endBlock, false);
  },

  follow: function () {
    follow();
  }

};

module.exports = blockParser;


function follow() {
  elasticClient.getHighestBlockIndex(function (topIndex) {
    // topIndex == -1 if there are no blocks in the index
    loopOverBlocks(topIndex + 1, Infinity, true);
  })
}


function processTransactions(transactionCount, blockNumber, maxBlockNumber, follow) {
  var recordedTransactions = 0;
  var transactions = [];
  var transactionIds = [];

  for (var transactionIndex = 0; transactionIndex < transactionCount; transactionIndex++) {

    (function (currTxIndex) {

      var transactionQueryString = '{"jsonrpc":"2.0","method":"eth_getTransactionByBlockNumberAndIndex","params":["0x' + Number(blockNumber).toString(16) + '", "0x' + currTxIndex.toString(16) + '"],"id":1}';

      gethClient.post(transactionQueryString, function (gethResponse) {
        try {
          var parsedResponse = JSON.parse(gethResponse);

          if (parsedResponse.result === null) {
            logger.error("transactionQuery result was null");
            return;
          }

          transactions[currTxIndex] = parsedResponse.result;
          transactionIds[currTxIndex] = blockNumber * 100000 + currTxIndex;
          recordedTransactions += 1;

          if (recordedTransactions === transactionCount) {
            elasticClient.postTransactions(transactions, transactionIds, function (elasticError, elasticResponse) {
              if (elasticError) {
                logger.error(elasticError);
              }
              if (elasticResponse.errors) {
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
    })(transactionIndex);
  }
}


function loopOverBlocks(blockNumber, maxBlockNumber, follow) {
  logger.info('Transaction parser: ***** Fetching block with number ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') *****');
  var transactionCountQuery = '{"jsonrpc":"2.0","method":"eth_getBlockTransactionCountByNumber","params":["0x' + Number(blockNumber).toString(16) + '"],"id":1}';

  gethClient.post(transactionCountQuery, function (transactionCountResult) {

    var parsedTransactionCount = JSON.parse(transactionCountResult);
    if (parsedTransactionCount.result === null) {
      // we did not find any block
      if (follow) {
        sleep(12000).then(function () {
          return loopOverBlocks(blockNumber, maxBlockNumber, follow)
        });
      } else {
        logger.warn('Block ' + blockNumber + ' (0x' + Number(blockNumber).toString(16) + ') does not seem to exist!');
        return null;
      }
    } else {

      var transactionCount = parseInt(parsedTransactionCount.result);
      if (transactionCount === 0) {
        // nothing to do for this block
        logger.info('No transactions found');
        if (blockNumber < maxBlockNumber) {
          return loopOverBlocks(blockNumber + 1, maxBlockNumber, follow);
        }
        return null;
      }
      logger.info('Found transactions: ' + transactionCount);
      processTransactions(transactionCount, blockNumber, maxBlockNumber, follow);
    }
  });
}


function sleep(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
}