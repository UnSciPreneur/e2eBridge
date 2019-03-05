'use strict';

const config = require('config');
const log4js = require('log4js');

const gethClient = require('./gethClient');
const elasticClient = require('./elasticClient');

const logger = log4js.getLogger('blPa');
logger.setLevel(config.get('logging.level'));


var blockParser = {

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

module.exports = blockParser;


function processBlock(parsedBlock, blockNumber, maxBlockNumber, follow) {
  elasticClient.postBlock(parsedBlock, blockNumber, function (elasticError, elasticResponse) {
    if (elasticError) {
      logger.error(elasticError);
    }
    logger.trace(elasticResponse);

    if (blockNumber < maxBlockNumber) {
      return loopOverBlocks(blockNumber + 1, maxBlockNumber, follow);
    }
    return null;
  });  // end store block in ES
}


function loopOverBlocks(blockNumber, maxBlockNumber, follow) {
  logger.info('*** Fetching block with number ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') ***');
  var blockQueryString = '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x' + blockNumber.toString(16) + '", false],"id":1}';

  gethClient.post(blockQueryString, function (blockQueryResponse) {

    var parsedBlockQueryResponse = JSON.parse(blockQueryResponse);
    if (parsedBlockQueryResponse.result === null) {
      // we did not find any block; wait one block time and retry
      if (follow) {
        sleep(Number(config.get('constants.sleep_between_blocks'))).then(function () {
          return loopOverBlocks(blockNumber, maxBlockNumber, follow)
        });
      } else {
        logger.warn('Block ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') does not seem to exist!');
        return null;
      }
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