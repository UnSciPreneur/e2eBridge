'use strict';

// see https://github.com/ethereum/wiki/wiki/Ethereum-Contract-ABI


const config = require('config');
const elasticsearch = require('elasticsearch');
const log4js = require('log4js');
const SHA3 = require('sha3');


//console.log(mapFunction("kill()"));

const argumentTypes = ['address', 'string', 'uint256'];

const keywords = ['requestWithdrawal', 'kill', 'create', 'init'];

var methodNameGuesser = {
  generate: function (target, depth) {
    return generate(target, depth);
  },

  map: function (methodSignature) {
    return mapFunction(methodSignature)
  }
};

module.exports = methodNameGuesser;

// 0xa9059cbb
// 000000000000000000000000cce0730db708d6566f266bfd53803a881ce93546
// 00000000000000000000000000000000000000000000000000000004a817c800


function generate(target, depth) {
  var signature;
  for (var i = 0; i < keywords.length; i++) {
    for (var j = 0; j < Math.pow(argumentTypes.length, depth); j++) {
      signature = keywords[i] + '(' + generateArgumentString(j, depth) + ')';
      if (mapFunction(signature) === target) {
        return signature;
      }
    }
  }
  return null;
}

function generateArgumentString(ind, depth) {
  if (depth === 0 ) {
    return '';
  }
  if (depth === 1) {
    return argumentTypes[ind];
  }

  return argumentTypes[Math.floor(ind / argumentTypes.length)] + ',' + argumentTypes[ind % argumentTypes.length];
}



function mapFunction(methodSignature) {
  var sha3 = new SHA3.SHA3Hash(256);
  sha3.update(methodSignature);
  return sha3.digest('hex').substr(0, 8);
}
