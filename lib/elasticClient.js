'use strict';

const config = require('config');
const elasticsearch = require('elasticsearch');
var ethUtil = require('ethereumjs-util');
const log4js = require('log4js');
const SHA3 = require('sha3');


const client = new elasticsearch.Client({
  host: (process.env.ELSTACK_PORT_9200_TCP_ADDR || config.get('elasticsearch.host')) + ':' + config.get('elasticsearch.port'),
  log: 'warning',
  sniffOnStart: false
});

const logger = log4js.getLogger('elastic');
logger.setLevel(config.get('logging.level'));


var elasticClient = {

  init: function (idx) {
    setupIndexAndMappings(idx);
  },

  destroyIndexIfExists: function (idx, callback) {
    deleteIndex(idx, callback);
  },

  postBlock: function (data, id, callback) {
    createElement(enrichBlockData(data), 'block', id, callback);
  },

  postTransactions: function (data, ids, callback) {
    for (var i = 0; i < data.length; i++) {
      data[i] = enrichTransactionData(data[i]);
    }
    createBulkElement(data, 'transaction', ids, callback);
  },

  getTransactionsForContracts: function (blockNumber, maxBlockNumber, callback) {
    client.search({
        index: config.get('elasticsearch.indices.transactions.name'),
        body: {
          query: {
            bool: {
              must_not: {
                exists: {
                  field: 'to'
                }
              },
              must: {
                range: {
                  blockNumber: {
                    gte: blockNumber,
                    lt: Math.min(maxBlockNumber + 1, blockNumber + config.get('contracts.batchsize'))
                  }
                }
              }
            }
          },
          from: 0,
          size: 10000,
          sort: [{
            timestamp: {order: 'asc'}
          }]
        }
      }
    ).then(function (resp) {
      var hits = resp.hits.hits;
      if (hits.length > 0) {
        callback(resp);
      } else {
        // We did not find any records
        callback(-1);
      }
    }, function (err) {
      logger.error(err.message);
      process.exit(1);
    });
  },

  getContracts: function (blockNumber, maxBlockNumber, callback) {
    client.search({
        index: config.get('elasticsearch.indices.contracts.name'),
        body: {
          query: {
            bool: {
              must: {
                range: {
                  blockNumber: {
                    gte: blockNumber,
                    lt: Math.min(maxBlockNumber + 1, blockNumber + config.get('contracts.batchsize'))
                  }
                }
              }
            }
          },
          from: 0,
          size: 10000,
          sort: [{
            timestamp: {order: 'asc'}
          }]
        }
      }
    ).then(function (resp) {
      var hits = resp.hits.hits;
      if (hits.length > 0) {
        callback(resp);
      } else {
        // We did not find any records
        callback(-1);
      }
    }, function (err) {
      logger.error(err.message);
      process.exit(1);
    });
  },

  postContracts: function (data, callback) {
    var ids = {};
    for (var i = 0; i < data.length; i++) {
      ids[i] = data[i]._id;
      data[i] = enrichContractData(data[i]._source);
    }
    createBulkElement(data, 'contract', ids, callback);
  },

  updateContracts: function (data, callback) {
    var ids = {};
    var update = [];
    for (var i = 0; i < data.length; i++) {
      ids[i] = data[i]._id;
      update[i] = {};
      if (data[i]._source && data[i]._source.hasOwnProperty('balance')) {
        update[i].balance = parseFloat(parseInt(data[i]._source.balance) / config.get('constants.value_quotient'));
      }
      if (data[i]._source && data[i]._source.hasOwnProperty('code')) {
        update[i].code = data[i]._source.code;
        update[i].codeLength = data[i]._source.codeLength;
        update[i].codeHash = data[i]._source.codeHash;
      }
    }
    updateBulkElement(update, 'contract', ids, callback);
  },

  getHighestBlockIndex: function (callback) {
    getHighestBlockIndex(callback);
  },

  getStats: function (callback) {
    return getStats(callback);
  },

  ping: function () {
    return ping();
  }

};

module.exports = elasticClient;


function ping() {
  client.ping({
    requestTimeout: 3000,

    // undocumented params are appended to the query string
    hello: "elasticsearch"
  }, function (error) {
    if (error) {
      logger.error('elasticsearch cluster is down!');
      process.exit(1);
    } else {
      logger.info('All is well');
    }
  });
}


function getStats(callback) {
  client.count({
    index: config.get('elasticsearch.indices.blocks.name')
  }).then(function (responseBlock) {
    client.count({
      index: config.get('elasticsearch.indices.transactions.name')
    }).then(function (responseTransaction) {
      callback(null, {blockCount: responseBlock.count, transactionCount: responseTransaction.count});
    }, function (error) {
      logger.error(error.message);
      callback(error, null);
    });
  }, function (error) {
    logger.error(error.message);
    callback(error, null);
  });
}


function getHighestBlockIndex(callback) {
  client.search({
    index: config.get('elasticsearch.indices.blocks.name'),
    body: {
      query: {
        match_all: {}
      },
      sort: [{
        number: {order: 'desc'}
      }]
    },
    size: 1
  }).then(function (resp) {
    var hits = resp.hits.hits;
    if (hits.length > 0) {
      callback(hits[0]._source.number);
    } else {
      // We did not find any records
      callback(-1);
    }
  }, function (err) {
    logger.error(err.message);
    process.exit(1);
  });
}


function setupIndexAndMappings(idx) {
  var idxMappings = require('../config/ethereum/' + config.get('elasticsearch.indices.' + idx + '.mapping_file'));
  client.indices.create({
    index: config.get('elasticsearch.indices.' + idx + '.name'),
    body: idxMappings
  }).then(function (resp) {
    logger.trace(resp);
    logger.info('Index [' + config.get('elasticsearch.indices.' + idx + '.name') + '] created successfully.');
    process.exit(0);
  }, function (err) {
    logger.error(err.message);
    process.exit(1);
  });
}


function deleteIndex(idx, callback) {
  client.indices.get({index: config.get('elasticsearch.indices.' + idx + '.name')}).then(function (resp) {
    logger.trace(resp);
    client.indices.delete({
      index: config.get('elasticsearch.indices.' + idx + '.name')
    }).then(function (resp) {
      logger.trace(resp);
      logger.warn('Index [' + config.get('elasticsearch.indices.' + idx + '.name') + '] deleted');
      callback(idx);
    }, function (err) {
      logger.error('Unexpected error during index deletion: ' + err.message);
    });
  }, function (err) {
    if (err.status === 404) {
      logger.info('Index did not exist and is created anew.');
      callback(idx);
    } else {
      logger.error('Unexpected error during index lookup: ' + err.message);
    }
  });
}


function createElement(data, type, id, callback) {
  client.create({
    index: config.get('elasticsearch.indices.' + type + 's.name'),
    type: type,
    id: id,
    body: data
  }, function (error, response) {
    if (error) {
      if (!error.status && error.message === "No Living connections") {
        logger.warn('Retrying');
        setTimeout(function () {
          createElement(data, type, id, callback)
        }, Number(config.get('elasticsearch.retry_delay')));
      } else if (error.status === 409) {
        // document already exists
        logger.warn('Object already exists: ' + error.path);
        callback(null, response);
      } else if (error.status === 408) {
        // request timed out
        // ToDo: retry the request!
        callback(error, response);
      } else {
        callback(error, response);
      }
    } else {
      callback(error, response);
    }
  });
}

// see https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#api-bulk
function createBulkElement(data, type, ids, callback) {
  var body = [];

  for (var i = 0; i < data.length; i++) {
    body.push({
      create: {
        _index: config.get('elasticsearch.indices.' + type + 's.name'),
        _type: type,
        _id: ids[i]
      }
    });
    body.push(data[i])
  }

  client.bulk({
    body: body
  }, function (error, response) {
    if (error) {
      logger.error(error.message);
      if (!error.status && error.message === "No Living connections") {
        logger.warn('Retrying');
        setTimeout(function () {
          createBulkElement(data, type, ids, callback);
        }, Number(config.get('elasticsearch.retry_delay')));
      } else {
        process.exit(1);
      }
    } else {
      if (response && response.errors) {
        for (var i = 0; i < response.items.length; i++) {
          if (response.items[i].create.status === 409) {
            logger.warn('Object already exists: /' + response.items[i].create._index + '/' + response.items[i].create._type + '/' + response.items[i].create._id + '/_create');
          }
        }
      }

      callback(error, response);
    }
  });
}

function updateBulkElement(data, type, ids, callback) {
  var body = [];

  for (var i = 0; i < data.length; i++) {
    body.push({
      update: {
        _index: config.get('elasticsearch.indices.' + type + 's.name'),
        _type: type,
        _id: ids[i]
      }
    });
    body.push({doc: data[i]});
    logger.trace(data[i]);
  }

  client.bulk({
    body: body
  }, function (error, response) {
    if (error) {
      logger.error(error);
      if (!error.status && error.message === "No Living connections") {
        logger.warn('Retrying');
        setTimeout(function () {
          createBulkElement(data, type, ids, callback);
        }, Number(config.get('elasticsearch.retry_delay')));
      } else {
        process.exit(1);
      }
    } else {
      if (response && response.errors) {
        for (var i = 0; i < response.items.length; i++) {
          logger.warn('Error during update');
          if (response.items[i].update.error) {
            logger.info(response.items[i].update.error.type);
          }
        }
      }

      callback(error, response);
    }
  });
}


function enrichBlockData(block) {
  block.numTransactions = block.transactions.length;
  block.numUncles = block.uncles.length;

  // replace some hex values by their integer representation (elastic cannot handle hex)
  block.size = parseInt(block.size);
  block.gasLimit = parseInt(block.gasLimit);
  block.gasUsed = parseInt(block.gasUsed);
  block.number = parseInt(block.number);
  // Javascript does not have a problem with large integers, but ES seems to struggle with large integers
  block.difficulty = parseFloat(parseInt(block.difficulty) / config.get('constants.difficulty_quotient'));
  block.totalDifficulty = parseFloat(parseInt(block.totalDifficulty) / config.get('constants.difficulty_quotient'));
  block.timestamp = new Date(parseInt(block.timestamp * 1000));

  return JSON.stringify(block);
}


function enrichTransactionData(transaction) {
  // Problem: ElasticSearch only knows the following simple data types:
  //    text, keyword, date, long, double, boolean or ip.
  // jspaillier uses the npm module "jsbn" which allows for practically arbitrary length integer

  // Javascript does not have a problem with large integers, but ES seems to struggle with large integers
  // the maximum value for long in ES is 2^63-1 = 9223372036854775807 = 9 * 10^18 which obviously is to little
  transaction.value = parseFloat(parseInt(transaction.value) / config.get('constants.value_quotient')); // denominated in Gwei
  transaction.gas = parseInt(transaction.gas);
  transaction.gasPrice = parseInt(transaction.gasPrice);
  transaction.transactionIndex = parseInt(transaction.transactionIndex);
  transaction.blockNumber = parseInt(transaction.blockNumber);

  return JSON.stringify(transaction);
}


function enrichContractData(contract) {
  // see https://github.com/ethereum/pyethereum/blob/782842758e219e40739531a5e56fff6e63ca567b/ethereum/utils.py
  // for contract address calculation
  var sha3 = new SHA3.SHA3Hash(256);
  sha3.update(contract.input, 'ascii');
  contract.inputHash = sha3.digest('hex').substr(0, 16);
  contract.inputLength = contract.input.length / 2 - 1;

  var nonce = contract.nonce;
  // nonce should be hex encoded but not start with '0x'
  if (nonce.substr(0, 2) === '0x') {
    nonce = nonce.substr(2);
  }
  // nonce might have odd length
  if (nonce.length % 2) {
    nonce = '0' + nonce;
  }
  contract.contractAddress = ethUtil.bufferToHex(ethUtil.generateAddress(Buffer.from(contract.from.substr(2), 'hex'), Buffer.from(nonce, 'hex')));

  // delete some unwanted attributes from contract object
  delete contract.gasPrice;
  delete contract.nonce;
  delete contract.r;
  delete contract.s;
  delete contract.v;
  delete contract.to;
  delete contract.hash;
  delete contract.transactionIndex;
  delete contract.blockHash;
  // the following seem to require geth v1.7.3 or newer
  delete contract.raw;
  delete contract.networkId;
  delete contract.publicKey;
  delete contract.standardV;
  delete contract.creates;  // a nice equivalent of contractAddress
  delete contract.condition;

  return JSON.stringify(contract);
}
