'use strict';

const config = require('config');
const elasticsearch = require('elasticsearch');
var ethUtil = require('ethereumjs-util');
const log4js = require('log4js');
const SHA3 = require('sha3');


const client = new elasticsearch.Client({
  host: config.get('elasticsearch.host') + ':' + config.get('elasticsearch.port'),
  log: 'warning',
  sniffOnStart: false
});

const logger = log4js.getLogger('elastic');
logger.setLevel(config.get('logging.level'));


var elasticClient = {

  init: function () {
    setupIndexAndMappings();
  },

  destroy: function (callback) {
    deleteIndex(callback);
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

  getContracts: function (blockNumber, callback) {
    client.search({
        index: config.get('elasticsearch.index.name'),
        type: 'transaction',
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
                    lt: blockNumber + config.get('contracts.batchsize')
                  }
                }
              }
            }
          },
          from: 0,
          size: 10000,
          sort:
            [{
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
      process.exit();
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
      process.exit();
    } else {
      logger.info('All is well');
    }
  });
}


function getStats(callback) {
  client.count({
    index: config.get('elasticsearch.index.name'),
    type: 'block'
  }, function (error, responseBlock) {
    client.count({
      index: config.get('elasticsearch.index.name'),
      type: 'transaction'
    }, function (error, responseTransaction) {
      callback({blockCount: responseBlock.count, transactionCount: responseTransaction.count});
    });
  });
}


function getHighestBlockIndex(callback) {
  client.search({
    index: config.get('elasticsearch.index.name'),
    type: 'block',
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
    process.exit();
  });
}


function setupIndexAndMappings() {
  client.indices.create({
    index: config.get('elasticsearch.index.name'),
    body: {
      "number_of_shards": config.get('elasticsearch.index.number_of_shards'),
      "number_of_replicas": config.get('elasticsearch.index.number_of_replicas')
    }
  }).then(function (resp) {
    logger.trace(resp);
    logger.info('Index [' + config.get('elasticsearch.index.name') + '] created successfully.');

    var blockMapping = require('../config/ethereum/blockMapping.json');
    client.indices.putMapping({
      index: config.get('elasticsearch.index.name'),
      type: 'block',
      body: blockMapping
    }).then(function (resp) {
      logger.trace(resp);
      logger.info('Mappings for type block created successfully.');

      var transactionMapping = require('../config/ethereum/transactionMapping.json');
      client.indices.putMapping({
        index: config.get('elasticsearch.index.name'),
        type: 'transaction',
        body: transactionMapping
      }).then(function (resp) {
        // ToDo: add mapping for contracts here
        logger.trace(resp);
        logger.info('Mappings for type transaction created successfully.');
      }, function (err) {
        logger.error(err.message);
      });
    }, function (err) {
      logger.error(err.message);
    });
  }, function (err) {
    logger.error(err.message);
  });
}


function deleteIndex(callback) {
  client.indices.get({index: config.get('elasticsearch.index.name')}).then(function (resp) {
    logger.trace(resp);
    client.indices.delete({
      index: config.get('elasticsearch.index.name')
    }).then(function (resp) {
      logger.trace(resp);
      logger.warn('Index [' + config.get('elasticsearch.index.name') + '] deleted');
      callback();
    }, function (err) {
      logger.error('Unexpected error during index deletion: ' + err.message);
    });
  }, function (err) {
    if (err.status === 404) {
      logger.info('Index did not exist and is created anew.');
      callback();
    } else {
      logger.error('Unexpected error during index lookup: ' + err.message);
    }
  });
}


function createElement(data, type, id, callback) {
  client.create({
    index: config.get('elasticsearch.index.name'),
    type: type,
    id: id,
    body: data
  }, function (error, response) {
    if (error) {
      if (error.status === 409) {
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
        _index: config.get('elasticsearch.index.name'),
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
      logger.error(error);
    }
    if (response && response.errors) {
      for (var i = 0; i < response.items.length; i++) {
        if (response.items[i].create.status === 409) {
          logger.warn('Object already exists: /' + response.items[i].create._index + '/' + response.items[i].create._type + '/' + response.items[i].create._id + '/_create');
        }
      }
    }

    callback(error, response);
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
  block.difficulty = parseInt(block.difficulty);
  // ToDo: There should be a better way to handle bigNum!?
  block.totalDifficulty = parseFloat(parseInt(block.totalDifficulty) / 1000000);
  block.timestamp = new Date(parseInt(block.timestamp * 1000));

  return JSON.stringify(block);
}


function enrichTransactionData(transaction) {
  // ToDo: There should be a better way to handle large integers!?
  // Problem: ElasticSearch only knows the following simple data types:
  //    text, keyword, date, long, double, boolean or ip.
  // jspaillier uses the npm module "jsbn" which allows for practically arbitrary length integer

  // Maybe adjust this to 10^-9 to obtain Gwei?
  transaction.value = parseFloat(parseInt(transaction.value) / 1000000);
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
  sha3.update(contract.input);
  contract.codeHash = sha3.digest('hex').substr(0, 15);

  // nonce might have odd length
  var nonce = contract.nonce;
  if (nonce.length % 2) {
    nonce = "0" + nonce.substr(2);
  }
  contract.contractAddress = ethUtil.bufferToHex(ethUtil.generateAddress(Buffer.from(contract.from.substr(2), 'hex'), Buffer.from(nonce, 'hex')));

  return JSON.stringify(contract);
}