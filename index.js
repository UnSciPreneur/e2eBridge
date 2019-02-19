'use strict';

const commandLineArgs = require('command-line-args');
const config = require('config');
const log4js = require('log4js');

const blockParser = require('./lib/blockParser');
const transactionParser = require('./lib/transactionParser');
const combinedParser = require('./lib/combinedParser');
const contractParser = require('./lib/contractParser');
const elasticClient = require('./lib/elasticClient');

const logger = log4js.getLogger('main');
logger.setLevel(config.get('logging.level'));


const options = commandLineArgs([
  {name: 'mode', alias: 'm', type: String, defaultOption: true},
  {name: 'from', alias: 'f', type: Number},
  {name: 'to', alias: 't', type: Number}
]);

var from, to;

if (options.mode) {
  switch (options.mode) {
    case 'stats':
      printStats();
      break;
    case 'pingElastic':
      elasticClient.ping();
      break;
    case 'follow':
      combinedParser.follow();
      break;
    case 'batch':
      from = options.from || 0;
      to = options.to || Infinity;
      if (from <= to) {
        combinedParser.batchRun(from, to);
      }
      break;
    case 'blocks':
      from = options.from || 0;
      to = options.to || Infinity;
      blockParser.batchRun(from, to);
      break;
    case 'transactions':
      from = options.from || 0;
      to = options.to || Infinity;
      transactionParser.batchRun(from, to);
      break;
    case 'contracts':
      from = options.from || 0;
      to = options.to || Infinity;
      contractParser.batchRun(from, to);
      break;
    case 'contractBalances':
      from = options.from || 0;
      to = options.to || Infinity;
      contractParser.batchBalanceUpdate(from, to);
      break;
    case 'contractCodes':
      from = options.from || 0;
      to = options.to || Infinity;
      contractParser.batchCodeUpdate(from, to);
      break;
    case 'setup':
      logger.warn('All your current data will be lost!');

      const readline = require('readline');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('Are you sure you want to (re-)initialize all indices (' + config.get('elasticsearch.indices.blocks.name') + ', ' + config.get('elasticsearch.indices.transactions.name') + ', ' + config.get('elasticsearch.indices.contracts.name') + ')? [y/N] ', function (answer) {
        console.log("you entered: [" + answer.toString().trim() + "]");
        if (answer.toString().trim() === 'y' || answer.toString().trim() === 'Y') {
          clearIndex('blocks', initIndex);
          clearIndex('transactions', initIndex);
          clearIndex('contracts', initIndex);
        }
        rl.close();
      });
      break;
    default:
      logger.warn('Unknown mode ' + options.mode);
  }
} else {
  console.log('Please call as \'node index \<MODE\>\' where \<MODE\> is one of the following:\n');
  console.log('\t stats \t\t\t\t show some numbers');
  console.log('\t follow \t\t\t start indexing blocks at highest index in db');
  console.log('\t batch -f \<f\> -t \<t\>\t\t index blocks (and corresponding transactions) between \<f\> and \<t\>');
  console.log('\t blocks -f \<f\> -t \<t\>\t\t same as \'batch\' but only indexing blocks');
  console.log('\t transactions -f \<f\> -t \<t\>\t same as \'batch\' but only indexing transactions');
  console.log('\t contracts -f \<f\> -t \<t\>\t same as \'batch\' but only indexing contracts');
  console.log('\t contractBalances -f \<f\> -t \<t\>\t update contract balances for blocks between \<f\> and \<t\>');
  console.log('\t contractCodes -f \<f\> -t \<t\>\t update contract code for blocks between \<f\> and \<t\>\n');
  console.log('NOTE: \tYou have to run the tool in mode \'contracts\' at least once before');
  console.log('\t\'contractBalances\' and \'contractCodes\' will do anything.');
}

function printStats() {
  elasticClient.getStats(function (error, stats) {
    if (error) {
      logger.error(error.message);
      process.exit(1);
    } else {
      logger.info('The indices [' + config.get('elasticsearch.indices.blocks.name') + ', ' + config.get('elasticsearch.indices.transactions.name') + '] contain ' + stats.blockCount + ' blocks and ' + stats.transactionCount + ' transactions.');

      elasticClient.getHighestBlockIndex(function (highestIndex) {
        if (!highestIndex) {
          logger.warn("No blocks have been indexed yet.")
        } else if (stats.blockCount < highestIndex + 1) {
          logger.warn("We are missing blocks in the index: (" + stats.blockCount + '/' + highestIndex + ') present');
        }
        process.exit(0);
      });
    }
  });
}

function clearIndex(idx, callback) {
  logger.info('Dropping index [%s] if it exists.', idx);
  elasticClient.destroyIndexIfExists(idx, callback);
}

function initIndex(idx) {
  logger.info('Initializing index [%s].', idx);
  elasticClient.init(idx);
}

/*

 var options = { 'type': 'data',
 'searchBody' : '{"filter": { "or": [ {"type": {"value": "dashboard"}}, {"type" : {"value":"visualization"}}] }}'};

 var ElasticDump = require('elasticdump');

 console.log(ElasticDump);

 var elasticDump = new ElasticDump('http://localhost:9200/.kibana', './kibanadump.json', options);
 console.log(elasticDump);

 //elasticDump.elasticdump('http://localhost:9200/.kibana', './kibanadump.json', options);

 console.log(elasticDump);

 elasticDump.dump();

 */