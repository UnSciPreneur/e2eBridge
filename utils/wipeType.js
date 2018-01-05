/*
   Helper method that removes all documents of type CONTRACT from Elastic Search index
 */

'use strict';

const config = require('config');
const elasticsearch = require('elasticsearch');
const log4js = require('log4js');


const client = new elasticsearch.Client({
  host: config.get('elasticsearch.host') + ':' + config.get('elasticsearch.port'),
  log: 'warning',
  sniffOnStart: false
});

const logger = log4js.getLogger('elastic');
logger.setLevel(config.get('logging.level'));


function searchType(type, callback) {
  client.search({
      index: config.get('elasticsearch.index.name'),
      type: type,
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
                  gte: 0,
                  lte: 5000000
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
}

function deleteType(type, index) {

  if (type.hits.hits.length > index) {
    client.delete({
      index: config.get('elasticsearch.index.name'),
      type: type.hits.hits[index]._type,
      id: type.hits.hits[index]._id
    }, function (error, response) {
      if (error) {
        logger.error(error);
        process.exit();
      }
      if (response) {
        logger.info(response.result + ' ' + response._index + '/' + response._type + '/' + response._id);
      }
      if (index + 1 < type.hits.hits.length) {
        deleteType(type, index + 1);
      } else {
        process.exit();
      }
    });
  } else {
    logger.error('Invalid index!');
    process.exit();
  }
}

searchType('contract', function (contract) {
  if (contract !== -1) {
    deleteType(contract, 0);
  } else {
    process.exit();
  }
});
