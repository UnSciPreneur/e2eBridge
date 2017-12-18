"use strict";

var chai = require('chai');
var sinon = require('sinon');
var expect = chai.expect;
var opCodeParser;

describe('opCodeParser', function () {
  before(function () {
    console.log('starting');
    opCodeParser = require('./../../utils/opCodeParser');
  });

  after(function () {
    console.log('finished');
  });


  it('parse() handles long input correctly', function () {
    // those are some opcodes from the contract at 0xa327075af2a223a1c83a36ada1126afe7430f955

    var opCodes = '0x6060604052361561001f5760e060020a600035046372ea4b8c811461010c575b61011b3460008080678ac7230489e8000084106101d557600180548101908190556003805433929081101561000257906000526020600020900160006101000a815481600160a060020a0302191690830217905550678ac7230489e80000840393508350678ac7230489e800006000600082828250540192505081905550600260016000505411151561011d576003';
    var parsedOpCodes = "0x0000:\t(60)\tPUSH1\t0x60\n" +
      "0x0002:\t(60)\tPUSH1\t0x40\n" +
      "0x0004:\t(52)\tMSTORE\n" +
      "0x0005:\t(36)\tCALLDATASIZE\n" +
      "0x0006:\t(15)\tISZERO\n" +
      "0x0007:\t(61)\tPUSH2\t0x001f\n" +
      "0x000a:\t(57)\tJUMPI\n" +
      "0x000b:\t(60)\tPUSH1\t0xe0\n" +
      "0x000d:\t(60)\tPUSH1\t0x02\n" +
      "0x000f:\t(0a)\tEXP\n" +
      "0x0010:\t(60)\tPUSH1\t0x00\n" +
      "0x0012:\t(35)\tCALLDATALOAD\n" +
      "0x0013:\t(04)\tDIV\n" +
      "0x0014:\t(63)\tPUSH4\t0x72ea4b8c\n" +
      "0x0019:\t(81)\tDUP2\n" +
      "0x001a:\t(14)\tEQ\n" +
      "0x001b:\t(61)\tPUSH2\t0x010c\n" +
      "0x001e:\t(57)\tJUMPI\n" +
      "0x001f:\t(5b)\tJUMPDEST\n" +
      "0x0020:\t(61)\tPUSH2\t0x011b\n" +
      "0x0023:\t(34)\tCALLVALUE\n" +
      "0x0024:\t(60)\tPUSH1\t0x00\n" +
      "0x0026:\t(80)\tDUP1\n" +
      "0x0027:\t(80)\tDUP1\n" +
      "0x0028:\t(67)\tPUSH8\t0x8ac7230489e80000\n" +
      "0x0031:\t(84)\tDUP5\n" +
      "0x0032:\t(10)\tLT\n" +
      "0x0033:\t(61)\tPUSH2\t0x01d5\n" +
      "0x0036:\t(57)\tJUMPI\n" +
      "0x0037:\t(60)\tPUSH1\t0x01\n" +
      "0x0039:\t(80)\tDUP1\n" +
      "0x003a:\t(54)\tSLOAD\n" +
      "0x003b:\t(81)\tDUP2\n" +
      "0x003c:\t(01)\tADD\n" +
      "0x003d:\t(90)\tSWAP1\n" +
      "0x003e:\t(81)\tDUP2\n" +
      "0x003f:\t(90)\tSWAP1\n" +
      "0x0040:\t(55)\tSSTORE\n" +
      "0x0041:\t(60)\tPUSH1\t0x03\n" +
      "0x0043:\t(80)\tDUP1\n" +
      "0x0044:\t(54)\tSLOAD\n" +
      "0x0045:\t(33)\tCALLER\n" +
      "0x0046:\t(92)\tSWAP3\n" +
      "0x0047:\t(90)\tSWAP1\n" +
      "0x0048:\t(81)\tDUP2\n" +
      "0x0049:\t(10)\tLT\n" +
      "0x004a:\t(15)\tISZERO\n" +
      "0x004b:\t(61)\tPUSH2\t0x0002\n" +
      "0x004e:\t(57)\tJUMPI\n" +
      "0x004f:\t(90)\tSWAP1\n" +
      "0x0050:\t(60)\tPUSH1\t0x00\n" +
      "0x0052:\t(52)\tMSTORE\n" +
      "0x0053:\t(60)\tPUSH1\t0x20\n" +
      "0x0055:\t(60)\tPUSH1\t0x00\n" +
      "0x0057:\t(20)\tSHA3\n" +
      "0x0058:\t(90)\tSWAP1\n" +
      "0x0059:\t(01)\tADD\n" +
      "0x005a:\t(60)\tPUSH1\t0x00\n" +
      "0x005c:\t(61)\tPUSH2\t0x0100\n" +
      "0x005f:\t(0a)\tEXP\n" +
      "0x0060:\t(81)\tDUP2\n" +
      "0x0061:\t(54)\tSLOAD\n" +
      "0x0062:\t(81)\tDUP2\n" +
      "0x0063:\t(60)\tPUSH1\t0x01\n" +
      "0x0065:\t(60)\tPUSH1\t0xa0\n" +
      "0x0067:\t(60)\tPUSH1\t0x02\n" +
      "0x0069:\t(0a)\tEXP\n" +
      "0x006a:\t(03)\tSUB\n" +
      "0x006b:\t(02)\tMUL\n" +
      "0x006c:\t(19)\tNOT\n" +
      "0x006d:\t(16)\tAND\n" +
      "0x006e:\t(90)\tSWAP1\n" +
      "0x006f:\t(83)\tDUP4\n" +
      "0x0070:\t(02)\tMUL\n" +
      "0x0071:\t(17)\tOR\n" +
      "0x0072:\t(90)\tSWAP1\n" +
      "0x0073:\t(55)\tSSTORE\n" +
      "0x0074:\t(50)\tPOP\n" +
      "0x0075:\t(67)\tPUSH8\t0x8ac7230489e80000\n" +
      "0x007e:\t(84)\tDUP5\n" +
      "0x007f:\t(03)\tSUB\n" +
      "0x0080:\t(93)\tSWAP4\n" +
      "0x0081:\t(50)\tPOP\n" +
      "0x0082:\t(83)\tDUP4\n" +
      "0x0083:\t(50)\tPOP\n" +
      "0x0084:\t(67)\tPUSH8\t0x8ac7230489e80000\n" +
      "0x008d:\t(60)\tPUSH1\t0x00\n" +
      "0x008f:\t(60)\tPUSH1\t0x00\n" +
      "0x0091:\t(82)\tDUP3\n" +
      "0x0092:\t(82)\tDUP3\n" +
      "0x0093:\t(82)\tDUP3\n" +
      "0x0094:\t(50)\tPOP\n" +
      "0x0095:\t(54)\tSLOAD\n" +
      "0x0096:\t(01)\tADD\n" +
      "0x0097:\t(92)\tSWAP3\n" +
      "0x0098:\t(50)\tPOP\n" +
      "0x0099:\t(50)\tPOP\n" +
      "0x009a:\t(81)\tDUP2\n" +
      "0x009b:\t(90)\tSWAP1\n" +
      "0x009c:\t(55)\tSSTORE\n" +
      "0x009d:\t(50)\tPOP\n" +
      "0x009e:\t(60)\tPUSH1\t0x02\n" +
      "0x00a0:\t(60)\tPUSH1\t0x01\n" +
      "0x00a2:\t(60)\tPUSH1\t0x00\n" +
      "0x00a4:\t(50)\tPOP\n" +
      "0x00a5:\t(54)\tSLOAD\n" +
      "0x00a6:\t(11)\tGT\n" +
      "0x00a7:\t(15)\tISZERO\n" +
      "0x00a8:\t(15)\tISZERO\n" +
      "0x00a9:\t(61)\tPUSH2\t0x011d\n" +
      "0x00ac:\t(57)\tJUMPI\n" +
      "0x00ad:\t(60)\tPUSH1\t0x03\n";

    var parsed = opCodeParser.parse(opCodes);

    expect(parsed).to.eql(parsedOpCodes);
  });

  it('parses the contract correctly', function () {
    // those are from where?

      var opCodes = '7f4e616d65526567000000000000000000000000000000000000000000000000003055307f4e616d6552656700000000000000000000000000000000000000000000000000557f436f6e666967000000000000000000000000000000000000000000000000000073661005d2720d855f1d9976f88bb10c1a3398c77f5573661005d2720d855f1d9976f88bb10c1a3398c77f7f436f6e6669670000000000000000000000000000000000000000000000000000553360455560df806100c56000396000f3007f726567697374657200000000000000000000000000000000000000000000000060003514156053576020355415603257005b335415603e5760003354555b6020353360006000a233602035556020353355005b60007f756e72656769737465720000000000000000000000000000000000000000000060003514156082575033545b1560995733335460006000a2600033545560003355005b60007f6b696c6c00000000000000000000000000000000000000000000000000000000600035141560cb575060455433145b1560d25733ff5b6000355460005260206000f3';
          opCodes = '7f726567697374657200000000000000000000000000000000000000000000000060003514156053576020355415603257005b335415603e5760003354555b6020353360006000a233602035556020353355005b60007f756e72656769737465720000000000000000000000000000000000000000000060003514156082575033545b1560995733335460006000a2600033545560003355005b60007f6b696c6c00000000000000000000000000000000000000000000000000000000600035141560cb575060455433145b1560d25733ff5b6000355460005260206000f3';

      console.log(opCodeParser.parse(opCodes));
  });

  it('detects the creation header correctly', function () {
    // this is deployed in transaction 0xe5da56901c48d12e17ed9bc731dcd1d7424f8423d588ec943f8ec48552683c66
    var opCodes = '0x606060405260008055600380546006808355919082908015829011604357818360005260206000209182019101604391905b80821115609a57600081556001016031565b505080543392506000908110156002579081527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b8054600160a060020a0319169092179091556001556102fe8061009f6000396000f35b50905600';

    // console.log(opCodeParser.parse(opCodes));
    console.log(opCodeParser.detect(opCodes));
  });

  it('parses opcodes correctly', function () {
    // this is deployed in transaction 0xe5da56901c48d12e17ed9bc731dcd1d7424f8423d588ec943f8ec48552683c66
    var opCodes = '0x606060405260008055600380546006808355919082908015829011604357818360005260206000209182019101604391905b80821115609a57600081556001016031565b505080543392506000908110156002579081527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b8054600160a060020a0319169092179091556001556102fe8061009f6000396000f35b50905600';

    // console.log(opCodeParser.parse(opCodes));
    console.log(opCodeParser.parse(opCodes));
  });

  it('handles contract creation correctly', function () {
    // this is the contract creation tx of https://etherscan.io/address/0x863df6bfa4469f3ead0be8f9f2aae51c91a907b4

    var opCodes = '0x6060604052341561000c57fe5b5b61170f8061001c6000396000f300';

    console.log(opCodeParser.parse(opCodes));
  });
  
});