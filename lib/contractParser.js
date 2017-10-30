'use strict';

const config = require('config');
const log4js = require('log4js');

const gethClient = require('./gethClient');
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
  },

  update: function (blockNumber, maxBlockNumber) {
    prepareUpdate(blockNumber, maxBlockNumber);
  }

};

module.exports = contractParser;


function prepareUpdate(blockNumber, maxBlockNumber) {
  elasticClient.getContracts(blockNumber, maxBlockNumber, function (contractsQueryResponse) {
    if (contractsQueryResponse === -1) {
      if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
        return prepareUpdate(blockNumber + config.get('contracts.batchsize'), maxBlockNumber);
      } else {
        process.exit();
        return null;
      }
    }

    if (contractsQueryResponse.hits === null || contractsQueryResponse.hits.total === 0) {
      logger.warn('Block ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') did return a strange result!');
      return null;
    } else {
      return getContractBalances(contractsQueryResponse.hits.hits, blockNumber, maxBlockNumber);
    }
  });
}

function getContractBalances(contracts, blockNumber, maxBlockNumber) {
  var responseCounter = 0;
  var responseCounterTarget = contracts.length;

  for (var i = 0; i < responseCounterTarget; i++) {
    // use a closure to loop over all async calls
    (function (ind, responseCounterTarget, blockNumber, maxBlockNumber, contracts) {
      var balanceQueryString = '{"jsonrpc":"2.0","method":"eth_getBalance","params":["' + contracts[ind]._source.contractAddress + '", "latest"],"id":1}';
      gethClient.post(balanceQueryString, function (balanceQueryResponse) {
        responseCounter++;
        var parsedBalanceQueryResponse = JSON.parse(balanceQueryResponse);
        contracts[ind]._source.balance = parseInt(parsedBalanceQueryResponse.result.substr(2), 16);

        if (responseCounter === responseCounterTarget) {
          return updateContracts(contracts, blockNumber, maxBlockNumber);
        }
      });
    })(i, responseCounterTarget, blockNumber, maxBlockNumber, contracts);

  }
}


function updateContracts(contracts, blockNumber, maxBlockNumber) {
  elasticClient.updateContracts(contracts, function (elasticError, elasticResponse) {
    if (elasticError) {
      logger.error(elasticError);
    }
    logger.trace(elasticResponse);

    if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
      return prepareUpdate(blockNumber + config.get('contracts.batchsize'), maxBlockNumber);
    }
    process.exit();
    return null;
  }); // end store contracts in ES
}


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

  elasticClient.getTransactionsForContracts(blockNumber, maxBlockNumber, function (transactionQueryResponse) {
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

