'use strict';

const config = require('config');
const http = require('http');
const log4js = require('log4js');

// ToDo: why don't we use this instead of native POST requests?
// var Web3 = require('web3');
// var web3 = new Web3(new Web3.providers.HttpProvider('http://' + config.get('ethereum.host') + ':' + config.get('ethereum.port')));

const logger = log4js.getLogger('geth');
logger.setLevel(config.get('logging.level'));


var gethClient = {

  post: function (requestString, callback) {
    postToGeth(requestString, 0, callback);
  }

};

module.exports = gethClient;

function postToGeth(requestString, retryCounter, callback) {

  // An object of options to indicate where to post to
  var options = {
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
  const req = http.request(options, function (res) {
    res.setEncoding('utf8');
    var body = '';
    res.on('data', function (chunk) {
      body += chunk;
    }).on('error', function (e) {
      logger.warn("  Got error: " + e.message);
    }).on('end', function () {
      callback(body);
    });
  });

  req.on('error', function (err) {
    if (!retryCounter) {
      logger.warn("Post request to geth failed due to: " + err.message);
    }

    if (retryCounter < Number(config.get('ethereum.retry_attempts'))) {
      logger.warn('Retrying (' + (retryCounter + 1) + '/' + config.get('ethereum.retry_attempts') + ') for');
      logger.warn(requestString);
      setTimeout(function () {
        postToGeth(requestString, retryCounter + 1, callback);
      }, Number(config.get('ethereum.retry_delay')));
    } else {
      logger.error('Lost connection to geth permanently. Giving up!');
      process.exit(1);
    }
  });

  req.on('socket', function (socket) {
    // ToDo: configure timeout centrally; align with retry policy!
    socket.setTimeout(1000);
    socket.on('timeout', function() {
        req.abort();
        logger.warn('Aborted post to Ethereum client due to timeout');
    });
  });

  req.on('error', function(err) {
    if (err.code === "ECONNRESET") {
        logger.warn("Timeout occurs");
        //specific error treatment
    }
    //other error treatment
  });

  // post the data
  req.write(requestString);
  req.end();
}