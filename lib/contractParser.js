'use strict';

const config = require('config');
const elasticsearch = require('elasticsearch');
const http = require('http');
const log4js = require('log4js');
const rlp = require('rlp');
const sha3 = require('sha3');

const gethClient = require('./gethClient');
const elasticClient = require('./elasticClient');

const client = new elasticsearch.Client({
  host: config.get('elasticsearch.host') + ':' + config.get('elasticsearch.port'),
  log: 'warning'
});

const logger = log4js.getLogger('ctPa');
logger.setLevel(config.get('logging.level'));


var contractParser = {

  init: function (config) {

  },

  batchRun: function () {
    batch();
  },

  batchDelete: function () {
    batchDelete();
  },

  follow: function () {
    follow();
  }

};

module.exports = contractParser;


var queue = [];
var processing = false;
var processed = 0;


function batch() {
  enqueue(0, function() {
    logger.info('Queue length: ' + queue.length);

    if (!processing) {
      processQueue( function () {
        logger.info('Processed: ' + processed);
      });
    }
  });
}

function enqueue(index, callback) {
  client.search({
    index: config.get('elasticsearch.index.name'),
    type: 'transaction',
    body: {
      filter: {
        missing: {field: "to"}
      },
      query: {
        range: {
          blockNumber: {
            gte: index,
            lt : index + 10000
          }
        }
      },
      sort: [{
        blockNumber: {order: 'asc'},
        transactionIndex: {order: 'asc'}
      }],
      size: 10000
    }
  }).then(function (resp) {
    var hits = resp.hits.hits;

    for (var i = 0; i < hits.length; i++) {
      queue.push(enrichTransactionData(hits[i]._source));
    }

    if( index < 1900000) {
      enqueue(index + 10000, callback);
    } else {
      callback();
    }

  }, function (err) {
    logger.trace(err.message);
  });
}


function processQueue(callback) {
  if (queue.length === 0) {
    callback();
    return;
  }
  processing = true;

  client.index({
    index: config.get('elasticsearch.index.name'),
    type: 'contract',
    id: queue[0].contractAddress,
    body: queue[0]
  }, function (error) {
    if (!error) {
      processed += 1;
      if (!processing) {
        processQueue(callback);
      }
    }
  });

  queue.shift();
  processing = false;
}


function enrichTransactionData(response) {
  var hash = new sha3.SHA3Hash(256);
  var decodedValues = rlp.encode([new Buffer(response.from.substr(2), 'hex'), response.nonce]);
  hash.update(decodedValues);

  // ToDo: There should be a better way to handle bigNum!?
  response.contractAddress = '0x' + hash.digest('hex').substr(-40);
  response.value = parseFloat(parseInt(response.value) / 1000000);
  response.gas = parseInt(response.gas);
  response.gasPrice = parseFloat(parseInt(response.gasPrice) / 1000000);
  response.transactionIndex = parseInt(response.transactionIndex);
  response.blockNumber = parseInt(response.blockNumber);

  return response;
}


function batchDelete() {
  enqueueForDelete(0, function() {
    logger.info('Queue length: ' + queue.length);

    if (!processing) {
      deleteQueue( function () {
        logger.info('Deleted: ' + processed);
      });
    }
  });
}


function enqueueForDelete(index, callback) {
  client.search({
    index: config.get('elasticsearch.index.name'),
    type: 'contract',
    body: {
      query: {
        range: {
          blockNumber: {
            gte: index,
            lt : index + 10000
          }
        }
      },
      sort: [{
        blockNumber: {order: 'asc'},
        transactionIndex: {order: 'asc'}
      }],
      size: 10000
    }
  }).then(function (resp) {
    var hits = resp.hits.hits;

    for (var i = 0; i < hits.length; i++) {
      queue.push(hits[i]);
    }

    if( index < 1900000) {
      enqueueForDelete(index + 10000, callback);
    } else {
      callback();
    }

  }, function (err) {
    logger.trace(err.message);
  });

}


function deleteQueue(callback) {
  if (queue.length === 0) {
    callback();
    return;
  }
  processing = true;
  logger.info(queue[0]._id);

  client.delete({
    index: config.get('elasticsearch.index.name'),
    type: 'contract',
    id: queue[0]._id
  }, function (error) {
    if (!error) {
      processed += 1;
      if (!processing) {
        deleteQueue(callback);
      }
    }
  });

  queue.shift();
  processing = false;
}


