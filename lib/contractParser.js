'use strict';

const config = require('config');
const log4js = require('log4js');

const elasticClient = require('./elasticClient');

const logger = log4js.getLogger('coPa');
logger.setLevel(config.get('logging.level'));


var contractParser = {

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

module.exports = contractParser;


function processContracts(contracts, blockNumber, maxBlockNumber, follow) {
  elasticClient.postContracts(contracts, function (elasticError, elasticResponse) {
    if (elasticError) {
      logger.error(elasticError);
    }
    logger.trace(elasticResponse);

    if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
      return loopOverBlocks(blockNumber + config.get('contracts.batchsize'), maxBlockNumber, follow);
    }
    process.exit();
    return null;
  }); // end store contracts in ES
}


function loopOverBlocks(blockNumber, maxBlockNumber, follow) {
  logger.info('*** Fetching block with number ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') ***');

  elasticClient.getContracts(blockNumber, function (transactionQueryResponse) {
    if (transactionQueryResponse === -1) {
      if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
        return loopOverBlocks(blockNumber + config.get('contracts.batchsize'), maxBlockNumber, follow);
      } else {
        process.exit();
        return null;
      }
    }

    if (transactionQueryResponse.hits === null || transactionQueryResponse.hits.total === 0) {
        logger.warn('Block ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') did return a strange result!');
        return null;
    } else {
      return processContracts(transactionQueryResponse.hits.hits, blockNumber, maxBlockNumber, follow);
    }
  });
}

