"use strict";

var chai = require('chai');
var sinon = require('sinon');
var expect = chai.expect;

var VM = require('ethereumjs-vm');

//create a new VM instance
var vm = new VM();

// WATCH OUT! For some reason this does not work in the debugger!!!


vm.on('step', function (info, done) {
  //prints the program counter, the current opcode and the amount of gas left
  console.log('[vm]\t' + info.pc + '\tOpcode: ' + info.opcode.name + '\t\tGas: ' + info.gasLeft.toString());

  //prints out the current stack
  info.stack.forEach(function (item) {
    console.log('[vm]\t\t' + item.toString('hex'));
  });
  //important! call `done` when your done messing around
  done();
});

var code = '7f4e616d65526567000000000000000000000000000000000000000000000000003055307f4e616d6552656700000000000000000000000000000000000000000000000000557f436f6e666967000000000000000000000000000000000000000000000000000073661005d2720d855f1d9976f88bb10c1a3398c77f5573661005d2720d855f1d9976f88bb10c1a3398c77f7f436f6e6669670000000000000000000000000000000000000000000000000000553360455560df806100c56000396000f3007f726567697374657200000000000000000000000000000000000000000000000060003514156053576020355415603257005b335415603e5760003354555b6020353360006000a233602035556020353355005b60007f756e72656769737465720000000000000000000000000000000000000000000060003514156082575033545b1560995733335460006000a2600033545560003355005b60007f6b696c6c00000000000000000000000000000000000000000000000000000000600035141560cb575060455433145b1560d25733ff5b6000355460005260206000f3';
var codePayload = '7f726567697374657200000000000000000000000000000000000000000000000060003514156053576020355415603257005b335415603e5760003354555b6020353360006000a233602035556020353355005b60007f756e72656769737465720000000000000000000000000000000000000000000060003514156082575033545b1560995733335460006000a2600033545560003355005b60007f6b696c6c00000000000000000000000000000000000000000000000000000000600035141560cb575060455433145b1560d25733ff5b6000355460005260206000f3';

describe('ethereumVM', function () {

  it('runs a smart contract', function () {

    vm.runCode({
      code: Buffer.from(code, 'hex'), // code needs to be a Buffer
      gasLimit: Buffer.from('ffffffff', 'hex'),
      value: 0x1000000000,
      address: Buffer.from('1234567890123456789012345678901234567890', 'hex'),
      account: Buffer.from('9234567890123456789012345678901234567890', 'hex')
    }, function (err, results) {
      if (err) {
        console.error(err);
      }
      console.log('returned: ' + results.return.toString('hex'));
    });
  });

});