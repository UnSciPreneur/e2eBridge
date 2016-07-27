const http = require('http');
const config = require('config');

var gethClient = {

  init: function (config) {

  },

  post: function (requeststring, callback) {
    postToGeth(requeststring, callback);
  }

};

module.exports = gethClient;

function postToGeth(requeststring, callback) {

  // An object of options to indicate where to post to
  var post_options = {
    host: config.get('ethereum.host'),
    port: config.get('ethereum.port'),
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requeststring)
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
    }).on('error', function (e, res) {
      console.warn("  Got error: " + e.message);
    }).on('end', function () {
      callback(body);
    });
  });

  // post the data
  post_req.write(requeststring);
  post_req.end();
};