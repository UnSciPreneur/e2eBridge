'use strict';

const commandLineArgs = require('command-line-args');
const config = require('config');
const log4js = require('log4js');

const blockParser = require('./lib/blockParser');
const transactionParser = require('./lib/transactionParser');
const combinedParser = require('./lib/combinedParser');
const elasticClient = require('./lib/elasticClient');
const contractParser = require('./lib/contractParser');

const logger = log4js.getLogger('main');
logger.setLevel(config.get('logging.level'));


const cli = commandLineArgs([
  {name: 'mode', alias: 'm', type: String, defaultOption: true},
  {name: 'from', alias: 'f', type: Number},
  {name: 'to', alias: 't', type: Number}
]);

var options = cli.parse();
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
    case 'contract':
      contractParser.batchRun();
      break;
    case 'setup':
      logger.warn('All your current data will be lost!');

      const readline = require('readline');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('Are you sure you want to initialize the index (' + config.get('elasticsearch.index.name') + ')? [y/N] ', function (answer) {
        console.log("you entered: [" + answer.toString().trim() + "]");
        if (answer.toString().trim() === 'y' || answer.toString().trim() === 'Y') {
          clearIndex(initIndex);
        }
        rl.close();
      });
      break;
    default:
      logger.warn('Unknown mode ' + options.mode);
  }
} else {
  console.log('Please call as \'node e2eBridge MODE\' where MODE is one of the following:');
  console.log('\t stats \t\t\t show some numbers');
  console.log('\t follow \t\t start indexing blocks at highest index in db');
  console.log('\t batch -f \<f\> -t \<t\>\t index blocks between \<f\> and \<t\>');
}

function printStats() {
  elasticClient.getStats(function (stats) {
    logger.info('The index [' + config.get('elasticsearch.index.name') + '] contains ' + stats.blockCount + ' blocks and ' + stats.transactionCount + ' transactions.');

    elasticClient.getHighestBlockIndex(function (highestIndex) {
      if (!highestIndex) {
        logger.warn("No blocks have been indexed yet.")
      } else if (stats.blockCount < highestIndex + 1) {
        logger.warn("We are missing blocks in the index: (" + stats.blockCount + '/' + highestIndex + ') present');
      }
    });
  });
}

function clearIndex(callback) {
  logger.info('Dropping index...');
  // ToDo: check if the index exists
  elasticClient.destroy(callback);
}

function initIndex() {
  logger.info('Initializing index...');
  elasticClient.init();
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