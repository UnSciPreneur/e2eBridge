const http = require('http');
const log4js = require('log4js');
const logger = log4js.getLogger();

const gethClient = require('./gethClient');
const elasticClient = require('./elasticClient');

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
    if (topIndex) {
      loopOverBlocks(topIndex + 1, 100000000, true);
    } else {
      loopOverBlocks(0, 100000000, true);
    }
  })
}


function loopOverBlocks(blockNumber, maxBlockNumber, follow) {
  logger.info('*** Fetching block with number ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') ***');
  var blockQueryString = '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x' + blockNumber.toString(16) + '", false],"id":1}';

  gethClient.post(blockQueryString, function (blockQueryResponse) {

    var parsedBlockQueryResponse = JSON.parse(blockQueryResponse);

    if (parsedBlockQueryResponse.result == null) {
      // we did not find any block
      if (follow) {
        sleep(12000).then(function () {
          return loopOverBlocks(blockNumber, maxBlockNumber, follow)
        });
      } else {
        logger.warn('Block ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') does not seem to exist!');
        return null;
      }
    } else {
      elasticClient.postBlock(parsedBlockQueryResponse.result, blockNumber, function (elasticResponse) {

        var transactionCount = parsedBlockQueryResponse.result.transactions.length;
        if (transactionCount == 0) {
          // nothing to do for this block
          logger.info('No transactions found');
          if (blockNumber < maxBlockNumber) {
            return loopOverBlocks(blockNumber + 1, maxBlockNumber, follow);
          }
          return null;
        }
        logger.info('Found transactions: ' + transactionCount);

        var recordedTransactions = 0;

        for (var transactionIndex = 0; transactionIndex < transactionCount; transactionIndex++) {

          // this is necessary to pass transactionIndex into the closure
          (function (currTxIndex) {

            var transactionQueryString = '{"jsonrpc":"2.0","method":"eth_getTransactionByBlockNumberAndIndex","params":["0x' + blockNumber.toString(16) + '", "0x' + currTxIndex.toString(16) + '"],"id":1}';

            gethClient.post(transactionQueryString, function (gethResponse) {
              try {
                var parsedResponse = JSON.parse(gethResponse);

                if (parsedResponse.result == null) {
                  throw new Error("transactionQuery result was null");
                }

                // this is necessary to pass transactionIndex into the closure
                (function (currTxIndex) {
                  elasticClient.postTransaction(parsedResponse.result, blockNumber * 100000 + currTxIndex, function (elasticResponse) {

                    recordedTransactions += 1;
                    // we do not proceed to the next block unless we have seen all callbacks
                    if ((recordedTransactions == transactionCount) && (blockNumber < maxBlockNumber)) {
                      return loopOverBlocks(blockNumber + 1, maxBlockNumber, follow);
                    }
                  });  // end store transaction in ES
                })(currTxIndex);

              } catch (err) {
                logger.warn('There was an error parsing the response: ' + err);
              }
            });  // end get transactions
          })(transactionIndex);
        }
      });  // end store block in ES

    }
  });
}


function sleep(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
}