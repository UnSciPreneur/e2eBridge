const log4js = require('log4js');
const logger = log4js.getLogger();
const config = require('config');
const commandLineArgs = require('command-line-args');

const blockParser = require('./lib/blockParser');
const transactionParser = require('./lib/transactionParser');
const combinedParser = require('./lib/combinedParser');
const elasticClient = require('./lib/elasticClient');
const contractParser = require('./lib/contractParser');

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
    case 'follow':
      combinedParser.follow();
      break;
    case 'batch':
      from = options.from || 0;
      to = options.to || 20000000;
      combinedParser.batchRun(from, to);
      break;
    case 'blocks':
      from = options.from || 0;
      to = options.to || 20000000;
      blockParser.batchRun(from, to);
      break;
    case 'transactions':
      from = options.from || 0;
      to = options.to || 20000000;
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

      rl.question('Are you sure you want to initialize the index? [y/N] ', function (answer) {
        console.log("you entered: [" + answer.toString().trim() + "]");
        if (answer.toString().trim() === 'y' || answer.toString().trim() === 'Y') {
          logger.info('Initializing index...');
          elasticClient.destroy();
          elasticClient.init();
        }
        rl.close();
      });
      break;
    default:
      logger.warn('Unknown mode ' + options.mode);
  }
}

function printStats() {
  elasticClient.getStats(function (stats) {
    logger.info('The index [' + config.get('elasticsearch.index.name') + '] contains ' + stats.blockCount + ' blocks and ' + stats.transactionCount + ' transactions.');

    elasticClient.getHighestBlockIndex(function (highestIndex) {
      if (stats.blockCount < highestIndex + 1) {
        logger.warn("We are missing blocks in the index: (" + stats.blockCount + '/' + highestIndex + ') present');
      }
    });
  });
}

// create an index: curl -XPUT 'http://localhost:9200/ethereum/' -d '{ "settings" : { "index" : { "number_of_shards" : 3, "number_of_replicas" : 1  } } }'

// now run:       curl -XPUT 'http://localhost:9200/ethereum/block/_mapping' -d @config/blockMapping.json
// now run:       curl -XPUT 'http://localhost:9200/ethereum/transaction/_mapping' -d @config/transactionMapping.json
// or:            curl -XPUT 'http://localhost:9200/ethereum/address/_mapping' -d @config/addressMapping.json
// verify with:   curl -XGET 'localhost:9200/ethereum/_mapping/block'
// verify with:   curl -XGET 'localhost:9200/ethereum/_mapping/transaction'
// verify with:   curl -XGET 'localhost:9200/ethereum/_mapping/address'


// To store an address in the index
// curl -XPUT 'http://localhost:9200/ethereum/address/0x2910543af39aba0cd09dbb2d50200b3e800a63d2' -d '{"comment" : "Kraken"}'

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