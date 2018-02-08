'use strict';

const config = require('config');
const log4js = require('log4js');

const gethClient = require('./gethClient');
const elasticClient = require('./elasticClient');

const logger = log4js.getLogger('cmPa');
logger.setLevel(config.get('logging.level'));


var combinedParser = {

  batchRun: function (startBlock, endBlock) {
    loopOverBlocks(startBlock, endBlock, false);
  },

  follow: function () {
    elasticClient.getHighestBlockIndex(function (topIndex) {
      // topIndex == -1 if there are no blocks in the index
      loopOverBlocks(topIndex + 1, Infinity, true);
    });
  }

};

module.exports = combinedParser;


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
            logger.warn("transactionQuery result was null");
            // retry parsing this block! at least one transaction came back as null which is
            // usually the case if the geth client has not fully processed a new block yet
            sleep(12000).then(function () {
              return loopOverBlocks(blockNumber, maxBlockNumber, follow)
            });
          } else {
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
                  for (var i = 0; i < elasticResponse.errors.length; i++) {
                    if (elasticResponse.items[i].create.error) {
                      logger.error(elasticResponse.items[i].create.error);
                    }
                  }
                }

                logger.trace(elasticResponse);

                // we do not proceed to the next block unless we have seen all callbacks
                if (blockNumber < maxBlockNumber) {
                  return loopOverBlocks(blockNumber + 1, maxBlockNumber, follow);
                }
              });  // end store transaction in ES
            }
          }

        } catch (err) {
          logger.warn('There was an error parsing the response: ' + err);
        }
      });  // end get transactions
    })(transactionIndex, blockTime);
  }
}


function processBlock(parsedBlock, blockNumber, maxBlockNumber, follow) {
  elasticClient.postBlock(parsedBlock, blockNumber, function (elasticError, elasticResponse) {
    if (elasticError) {
      logger.error(elasticError);
    }
    logger.trace(elasticResponse);

    var transactionCount = parsedBlock.transactions.length;
    logger.debug('Number of transactions: ' + transactionCount);

    if (transactionCount === 0) {
      // nothing to do for this block
      if (blockNumber < maxBlockNumber) {
        return loopOverBlocks(blockNumber + 1, maxBlockNumber, follow);
      }
      return null;
    }
    var blockTime = parsedBlock.timestamp;
    return processTransactions(transactionCount, blockNumber, maxBlockNumber, blockTime, follow);
  });  // end store block in ES
}


function loopOverBlocks(blockNumber, maxBlockNumber, follow) {
  // to be less verbose in log level 'info' only log every 100 blocks
  if ((blockNumber % 100) === 0) {
    logger.info('*** Fetching block with number ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') ***');
  } else {
    logger.debug('*** Fetching block with number ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') ***');
  }
  var blockQueryString = '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x' + blockNumber.toString(16) + '", false],"id":1}';

  gethClient.post(blockQueryString, function (blockQueryResponse) {

    var parsedBlockQueryResponse = JSON.parse(blockQueryResponse);
    if (parsedBlockQueryResponse.result === null) {
      // we did not find any block; wait one block time and retry
      if (follow) {
        sleep(12000).then(function () {
          return loopOverBlocks(blockNumber, maxBlockNumber, follow);
        });
      } else {
        logger.warn('Block ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') does not seem to exist!');
        return null;
      }
    } else if (parsedBlockQueryResponse.error) {
      logger.error('Retrieving block failed: ' + parsedBlockQueryResponse.error.message);
      // wait and retry
      sleep(12000).then(function () {
        return loopOverBlocks(blockNumber, maxBlockNumber, follow);
      });
    } else {
      return processBlock(parsedBlockQueryResponse.result, blockNumber, maxBlockNumber, follow);
    }
  });
}


function sleep(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
}