'use strict';

const config = require('config');
const http = require('http');
const log4js = require('log4js');

const logger = log4js.getLogger('geth');
logger.setLevel(config.get('logging.level'));


var gethClient = {

  init: function (config) {

  },

  post: function (requestString, callback) {
    postToGeth(requestString, callback);
  }

};

module.exports = gethClient;

function postToGeth(requestString, callback) {

  // An object of options to indicate where to post to
  var post_options = {
    host: process.env.GETH_PORT_8545_TCP_ADDR || config.get('ethereum.host'),
    port: config.get('ethereum.port'),
    path: '/',
    method: 'POST',
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
      logger.warn("  Got error: " + e.message);
    }).on('end', function () {
      callback(body);
    });
  });

  post_req.on('error', function (err) {
    logger.warn("Could not connect to geth client because: " + err.message);
  });

  // post the data
  post_req.write(requestString);
  post_req.end();
}