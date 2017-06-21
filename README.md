# About

This tool collects data from the *ethereum* blockchain and pumps it into an Elasticsearch instance. 

## Requirements

_e2eBridge_ expects to find a geth client with rpc interface and an Elasticsearch instance. The URLs of both can be specified in the config.

## Setup

### Setting up Elasticsearch with docker

Pull the image from docker hub (https://hub.docker.com/r/blacktop/elastic-stack/):
```bash
docker pull blacktop/elastic-stack
```

```bash
docker run -d -p 9280:80 -p 127.0.0.1:9200:9200 --name elk blacktop/elastic-stack 
```
to start up the container for the first time which is then available at `localhost:9280`. Credentials are `admin/admin`. If you want to change open a shell in the docker container
```bash
docker exec -ti elk bash
```
and edit `/etc/nginx/.htpasswd`.

Later you can simply do
```bash
docker start elk
```
and
```bash
docker stop elk
```

Connect into a docker shell with
```bash
docker exec -ti elk bash
```

List all indices and aliases in your local system:
```
http://localhost:9200/_aliases?pretty=1
```
or equivalently
```
http://localhost:9200/_stats/indices
```
or from the command line:
```bash
curl 'localhost:9200/_cat/indices?v'
```

### Configuring Elasticsearch

**For all of the following we assume that we are in the git root of this project.**

First we create an index by running
```bash
curl -XPUT 'http://localhost:9200/ethereum/' -d '{ "settings" : { "index" : { "number_of_shards" : 2, "number_of_replicas" : 0  } } }'
```

In a second step we define mappings for our types:
```bash
curl -XPUT 'http://localhost:9200/ethereum/block/_mapping' -d @config/ethereum/blockMapping.json
curl -XPUT 'http://localhost:9200/ethereum/transaction/_mapping' -d @config/ethereum/transactionMapping.json
curl -XPUT 'http://localhost:9200/ethereum/address/_mapping' -d @config/ethereum/addressMapping.json
```

You can verify the result with
```bash
curl -XGET 'localhost:9200/ethereum/_mapping/block'
curl -XGET 'localhost:9200/ethereum/_mapping/transaction'
curl -XGET 'localhost:9200/ethereum/_mapping/address'
```

**IMPORTANT: Create the mappings before you start indexing documents! The mapping cannot be created after indexing.**

### Configuring Kibana

**Note:** Before configuring Kibana it might be necessary to actually import (some) data. Else certain fields are not available and some visualizations cannot be imported!

Now we import the visualizations and dashboards over the web GUI. The config files can be found in 
`config/ethereum/visualizations.json` and `config/ethereum/dashboards.json`

### Discovery with Kibana

Search for contract creating transactions:
`_type:transaction AND blockNumber:[0 TO 1900000] AND NOT to:*`

## Usage

### Elasticsearch

You can add an address manually by running
```bash
curl -XPUT 'http://localhost:9200/ethereum/address/0x2910543af39aba0cd09dbb2d50200b3e800a63d2' -d '{"comment" : "Kraken"}'
```

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
see https://github.com/ethereum/research/blob/master/uncle_regressions/block_datadump_generator.py