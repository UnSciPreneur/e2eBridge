'use strict';

const config = require('config');
const elasticsearch = require('elasticsearch');
const http = require('http');
const log4js = require('log4js');

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

  postTransaction: function (data, id, callback) {
    createElement(enrichTransactionData(data), 'transaction', id, callback);
  },

  postTransactions: function (data, id, callback) {
    createBulkElement(data, 'transaction', id, callback);
  },

  postContract: function (data, id, callback) {
    createElement(enrichContractData(data), 'contract', id, callback);
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
        logger.debug('Object already exists: ' + error.path);
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
function createBulkElement(data, type, id, callback) {
  var body = [];

  for (var i = 0; i < data.length; i++) {
    body.push({
      create: {
        _index: config.get('elasticsearch.index.name'),
        _type: type,
        _id: id[i]
      }
    });
    body.push(enrichTransactionData(data[i]))
  }

  client.bulk({
    body: body
  }, function (error, response) {
    callback(error, response);
  });
}

function enrichContractData(response) {
  return JSON.stringify(response);
}


function enrichBlockData(response) {
  if (Object.prototype.toString.call(response.transactions) === '[object Array]') {
    response.numTransactions = response.transactions.length;
  } else {
    response.numTransactions = 0;
  }
  response.numUncles = response.uncles.length;

  // replace some hex values by their integer representation (elastic cannot handle hex)
  response.size = parseInt(response.size);
  response.gasLimit = parseInt(response.gasLimit);
  response.gasUsed = parseInt(response.gasUsed);
  response.number = parseInt(response.number);
  response.difficulty = parseInt(response.difficulty);
  // ToDo: There should be a better way to handle bigNum!?
  response.totalDifficulty = parseFloat(parseInt(response.totalDifficulty) / 1000000);
  response.timestamp = new Date(parseInt(response.timestamp * 1000));

  return JSON.stringify(response);
}


function enrichTransactionData(response) {
  // ToDo: There should be a better way to handle bigNum!?
  response.value = parseFloat(parseInt(response.value) / 1000000);
  response.gas = parseInt(response.gas);
  response.gasPrice = parseInt(response.gasPrice);
  response.transactionIndex = parseInt(response.transactionIndex);
  response.blockNumber = parseInt(response.blockNumber);

  return JSON.stringify(response);
}

function postToElasticsearch(requestString, elasticPath, callback) {

  // An object of options to indicate where to post to
  var post_options = {
    host: config.get('elasticsearch.host'),
    port: config.get('elasticsearch.port'),
    path: elasticPath,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestString)
    }
  };

  // Set up the request
  var post_req = http.request(post_options, function (res) {
    res.setEncoding('utf8');
  });

  post_req.on('response', function (res) {
    var body = '';
    res.on('data', function (chunk) {
      body += chunk;
    }).on('error', function (e) {
      console.warn("  Got error: " + e.message);
    }).on('end', function () {
      callback(body);
    });
  });

  // post the data
  post_req.write(requestString);
  post_req.end();
}