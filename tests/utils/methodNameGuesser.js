"use strict";

var chai = require('chai');
var sinon = require('sinon');
var expect = chai.expect;
var methodNameGuesser;

describe('methodNameGuesser', function () {
  before(function () {
    console.log('starting');
    methodNameGuesser = require('./../../utils/methodNameGuesser');
  });

  after(function () {
    console.log('finished');
  });

  it('map() handles the function \'kill(address)\' correctly', function () {
    var res = methodNameGuesser.map('kill(address)');
    expect(res).to.eql('cbf0b0c0');
  });

  it('generate() works for depth 2', function () {
    var res = methodNameGuesser.generate('da95ebf7', 2);
    expect(res).to.eql('requestWithdrawal(address,uint256)')
  })
});

