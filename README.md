# About

This tool collects data from the *ethereum* blockchain and pumps it into an Elasticsearch instance. 

## Requirements

_e2eBridge_ expects to find a geth client with rpc interface and an Elasticsearch instance. The URLs of both can be specified in the config.

## Setup

### Configuring Elasticsearch

**For all of the following we assume that we are in the git root of this project.**

First we create an index by running
`curl -XPUT 'http://localhost:9200/ethereum/' -d '{ "settings" : { "index" : { "number_of_shards" : 3, "number_of_replicas" : 1  } } }'`

In a second step we define mappings for our types:

`curl -XPUT 'http://localhost:9200/ethereum/block/_mapping' -d @config/ethereum/blockMapping.json`

`curl -XPUT 'http://localhost:9200/ethereum/transaction/_mapping' -d @config/ethereum/transactionMapping.json`

`curl -XPUT 'http://localhost:9200/ethereum/address/_mapping' -d @config/ethereum/addressMapping.json`

You can verify the result with

`curl -XGET 'localhost:9200/ethereum/_mapping/block'`

`curl -XGET 'localhost:9200/ethereum/_mapping/transaction'`

`curl -XGET 'localhost:9200/ethereum/_mapping/address'`

**IMPORTANT: Create the mappings before you start indexing documents! The mapping cannot be created after indexing.**

### Configuring Kibana

Now we import the visualizations and dashboards over the web GUI. The config files can be found in 
`config/ethereum/visualizations.json` and `config/ethereum/dashboards.json`

### Discovery with Kibana

Search for contract creating transactions:
`_type:transaction AND blockNumber:[0 TO 1900000] AND NOT to:*`

## Usage

### Elasticsearch

You can add an address manually by running
`curl -XPUT 'http://localhost:9200/ethereum/address/0x2910543af39aba0cd09dbb2d50200b3e800a63d2' -d '{"comment" : "Kraken"}'`


# Other

## elasticdump

Backup kibana settings locally:
```bash
elasticdump \
    --input=http://localhost:9200/.kibana  \
    --output=$ \
    --type=data \
    --searchBody='{"filter": { "or": [ {"type": {"value": "dashboard"}}, {"type" : {"value":"visualization"}}] }}' \
    > kibana-exported.json
```

Transfer kibana settings from local machine to server:
```bash
elasticdump --input=http://localhost:9200/.kibana --output=http://app.b0x.it:9200/.kibana --type=data --searchBody='{"filter": { "or": [ {"type": {"value": "dashboard"}}, {"type" : {"value":"visualization"}}] }}'
```

## Ethereum RPC

* https://github.com/ethereum/wiki/wiki/JSON-RPC


## Alternative solutions

see https://github.com/nexusdev/elastic-ethereum