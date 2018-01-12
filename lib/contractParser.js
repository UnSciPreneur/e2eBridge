'use strict';

const config = require('config');
const log4js = require('log4js');
const SHA3 = require('sha3');

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

  batchCodeUpdate: function (blockNumber, maxBlockNumber) {
    prepareCodeUpdate(blockNumber, maxBlockNumber);
  },

  batchBalanceUpdate: function (blockNumber, maxBlockNumber) {
    prepareBalanceUpdate(blockNumber, maxBlockNumber);
  }

};

module.exports = contractParser;


function prepareBalanceUpdate(blockNumber, maxBlockNumber) {
  logger.info('*** Fetching contracts from blocks ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') onward ***');
  elasticClient.getContracts(blockNumber, maxBlockNumber, function (contractsQueryResponse) {
    if (contractsQueryResponse === -1) {
      if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
        return prepareBalanceUpdate(blockNumber + config.get('contracts.batchsize'), maxBlockNumber);
      } else {
        // stop the application as we have processed all blocks
        process.exit();
        return null;
      }
    }

    if (contractsQueryResponse.hits === null || contractsQueryResponse.hits.total === 0) {
      // this case should never occur as it is caught in elasticClient.getContracts()
      logger.warn('Block ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') did return a strange result!');
      return null;
    } else {
      return getContractBalances(contractsQueryResponse.hits.hits, blockNumber, maxBlockNumber);
    }
  });
}


function prepareCodeUpdate(blockNumber, maxBlockNumber) {
  logger.info('*** Fetching contracts from blocks ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') onward ***');
  elasticClient.getContracts(blockNumber, maxBlockNumber, function (contractsQueryResponse) {
    if (contractsQueryResponse === -1) {
      if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
        return prepareCodeUpdate(blockNumber + config.get('contracts.batchsize'), maxBlockNumber);
      } else {
        // stop the application as we have processed all blocks
        process.exit();
        return null;
      }
    }

    if (contractsQueryResponse.hits === null || contractsQueryResponse.hits.total === 0) {
      // this case should never occur as it is caught in elasticClient.getContracts()
      logger.warn('Block ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') did return a strange result!');
      return null;
    } else {
      return getContractCode(contractsQueryResponse.hits.hits, blockNumber, maxBlockNumber);
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
        if (parsedBalanceQueryResponse.error) {
          logger.warn('Could not fetch balance from geth due to: %s', parsedBalanceQueryResponse.error.message);
        } else {
          contracts[ind]._source.balance = parseInt(parsedBalanceQueryResponse.result.substr(2), 16);
        }

        if (responseCounter === responseCounterTarget) {
          return updateContractBalances(contracts, blockNumber, maxBlockNumber);
        }
      });
    })(i, responseCounterTarget, blockNumber, maxBlockNumber, contracts);

  }
}


function getContractCode(contracts, blockNumber, maxBlockNumber) {
  var responseCounter = 0;
  var responseCounterTarget = contracts.length;

  for (var i = 0; i < responseCounterTarget; i++) {
    // use a closure to loop over all async calls
    (function (ind, responseCounterTarget, blockNumber, maxBlockNumber, contracts) {
      var codeQueryString = '{"jsonrpc":"2.0","method":"eth_getCode","params":["' + contracts[ind]._source.contractAddress + '", "latest"],"id":1}';
      gethClient.post(codeQueryString, function (codeQueryResponse) {
        responseCounter++;
        var parsedCodeQueryResponse = JSON.parse(codeQueryResponse);
        if (parsedCodeQueryResponse.error) {
          logger.warn('Could not fetch code from geth due to: %s', parsedCodeQueryResponse.error.message);
        } else {
          var code = parsedCodeQueryResponse.result;
          contracts[ind]._source.code = code;
          var sha3 = new SHA3.SHA3Hash(256);
          sha3.update(code, 'ascii');
          contracts[ind]._source.codeHash = sha3.digest('hex').substr(0, 16);
          contracts[ind]._source.codeLength = code.length / 2 - 1;
          // do not update balances!
          delete contracts[ind]._source.balance;
        }

        if (responseCounter === responseCounterTarget) {
          return updateContractCode(contracts, blockNumber, maxBlockNumber);
        }
      });
    })(i, responseCounterTarget, blockNumber, maxBlockNumber, contracts);

  }
}


function updateContractCode(contracts, blockNumber, maxBlockNumber) {
  elasticClient.updateContracts(contracts, function (elasticError, elasticResponse) {
    if (elasticError) {
      logger.error(elasticError);
    }
    logger.trace(elasticResponse);

    if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
      return prepareCodeUpdate(blockNumber + config.get('contracts.batchsize'), maxBlockNumber);
    }
    process.exit();
    return null;
  }); // end store contracts in ES
}


function updateContractBalances(contracts, blockNumber, maxBlockNumber) {
  elasticClient.updateContracts(contracts, function (elasticError, elasticResponse) {
    if (elasticError) {
      logger.error(elasticError);
    }
    logger.trace(elasticResponse);

    if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
      return prepareBalanceUpdate(blockNumber + config.get('contracts.batchsize'), maxBlockNumber);
    }
    process.exit();
    return null;
  }); // end store contracts in ES
}


function processContracts(contracts, blockNumber, maxBlockNumber, follow) {
  elasticClient.postContracts(contracts, function (elasticError, elasticResponse) {
    // we have stored a contract type with the fields from the corresponding transaction
    // this does not include the actual contract.code (which can only be obtained from geth)
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
    // returns the contracts from config('contracts.batchsize') many consecutive blocks
    if (transactionQueryResponse === -1) {
      // we did not find any smart contract
      if (blockNumber + config.get('contracts.batchsize') <= maxBlockNumber) {
        return loopOverBlocks(blockNumber + config.get('contracts.batchsize'), maxBlockNumber, follow);
      } else {
        // ToDo: omit the following line?
        process.exit();
        return null; // we do not reach this return!?
      }
    }

    if (transactionQueryResponse.hits === null || transactionQueryResponse.hits.total === 0) {
      logger.warn('Block ' + blockNumber + ' (0x' + blockNumber.toString(16) + ') did return a strange result!');
      return null;
    } else {
      // write contracts to elastic search
      return processContracts(transactionQueryResponse.hits.hits, blockNumber, maxBlockNumber, follow);
    }
  });
}

