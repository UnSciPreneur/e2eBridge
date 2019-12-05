# About

This tool collects data from the *Ethereum* blockchain and pumps it into an *Elasticsearch* instance.

## Requirements

*e2eBridge* expects to find a geth/parity client with rpc interface and an Elasticsearch instance. The URLs of both can be specified in the config.

The parity client has not been tested with this version of *e2eBridge* but chances are good that everything works just as well.

## Running e2eBridge

We will explain how to setup *e2eBridge* and its dependencies further down. Assuming you have successfully set up everything for now.

To index all blocks (with block number in 1000000 to 2000000) run
```bash
node index batch [-f 1000000 -t 2000000]
```

Only after the previous step succeeded you can extract smart contracts into an own index via
```bash
node index contracts [-f 1000000 -t 2000000]
```

You might also want to set/update the current balance of each of the contracts. Note that this explicitly refers to the balance at the time the e2eBridge tool runs. The initial balance (at contract creation) is stored in the field `value`.
```bash
node index contractBalances [-f 1000000 -t 2000000]
```

To add the contract code to each document (= contract) in the contracts index run
```bash
node index contractCodes [-f 1000000 -t 2000000]
```
*Note:* This will require a full node or else you will get an error message. E.g., for parity
```
This request is not supported because your node is running with state pruning. Run with --pruning=archive.
```

## Setup

### Setting up Elasticsearch with Docker

This version has been successfully tested with Elasticsearch 6.4. So we suggest to use this particular version in the following.

Pull the image from docker hub (https://hub.docker.com/r/blacktop/elastic-stack/):
```bash
docker pull blacktop/elastic-stack:6.1
```

```bash
docker run -d -p 9280:80 -p 127.0.0.1:9200:9200 --name elk blacktop/elastic-stack:6.4
```
to start up the container for the first time which is then available at `localhost:9280`. Credentials are `admin/admin`. If you want to change open a shell in the docker container
```bash
docker exec -ti elk bash
```
and edit `/etc/nginx/.htpasswd`.

**Mandatory changes:**
If you want to index the mainnet chain Elasticsearch will run into memory issues with the default settings of the blacktop image. You will have to increase *heap space* within the image by editing `/usr/share/elasticsearch/config/jvm.options` setting:
```
-Xms4g
-Xmx4g
```

If you want to run the setup behind a reverse proxy (e.g. for access control or added transport encryption) take the steps of the following paragraph.

### Troubleshooting

#### Virtual memory too low

If you run into an `max virtual memory areas vm.max_map_count [65530] is too low, increase to at least [262144]` error you have to set `vm.max_map_count` on the host via
```
$ sysctl vm.max_map_count
>> vm.max_map_count = 65530
$ sysctl -w vm.max_map_count=262144
>> vm.max_map_count = 262144
```

#### Request entity too large

If you receive an error code `413` (Request entity too large) make sure that Elasticsearch and the Nginx reverse proxy do support sufficiently large HTTP requests.

To set http request size in Nginx put the following into `/etc/nginx/nginx.conf`:

```
http {
    ...
    client_max_body_size 100M;
}
```

To set the request size in Elasticsearch set
```
http.max_content_length: 100mb
```
in `/etc/elasticsearch/elasticsearch.yml`.

### The ELK stack behind an Nginx reverse proxy

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

***NOTE:*** The indices can be created from within the tool by running
```
node index setup
```
In the following we give instructions for a manual setup of the Elasticsearch indices.

First we create the indices with appropriate types and mappings by running
```bash
curl -XPUT 'http://localhost:9200/blocks' -d@config/ethereum/blockMapping.json
curl -XPUT 'http://localhost:9200/transactions' -d@config/ethereum/transactionMapping.json
curl -XPUT 'http://localhost:9200/contracts' -d@config/ethereum/contractMapping.json
```

You can verify the result with
```bash
curl -XGET 'localhost:9200/_cat/indices?v'
curl -XGET 'localhost:9200/blocks/_mappings'
curl -XGET 'localhost:9200/transactions/_mappings'
curl -XGET 'localhost:9200/contracts/_mappings'
```

**IMPORTANT: Create the mappings before you start indexing documents! The mapping cannot be created after indexing.**

### Configuring Kibana

**Note:** Before configuring Kibana it might be necessary to actually import (some) data. Else certain indices/fields are not available and some visualizations cannot be imported!

### Setting up index patterns

We recommend to set up four index patterns:
   * `blocks`
   * `transactions`
   * `contracts`
   * `*`

The patterns one through three correspond to exactly one type each. The fourth pattern comprises all types (which then can be internally distinguished by the field `_type`.)

Next we import the visualizations and dashboards over the web GUI. The config files can be found in
`config/ethereum/visualizations.json` and `config/ethereum/dashboards.json`

### Discovery with Kibana

Search for contract creating transactions: Select the index `transactions` and run one of the following queries
```
blockNumber:[4000000 TO 4100000] AND NOT to:*
```
or
```
blockNumber:[4000000 TO 4100000] AND !(_exists_:"to")
```

## Usage

### Elasticsearch

***The index for addresses is work in progress and not yet implemented.***

You can add an address manually by running
```bash
curl -XPUT 'http://localhost:9200/addresses/0x2910543af39aba0cd09dbb2d50200b3e800a63d2' -d '{"comment" : "Kraken"}'
```

### Known Issues of Elasticsearch

Elasticsearch does not support integers beyond 2^63-1 = 9223372036854775807 = 9 * 10^18 (data type `long`). This obviously is to little for the value field in transactions (and for totalDifficulty in blocks).
*Workaround:* Instead of integer values we store `float(value / 1000000000)`, i.e. we denote values in floating Gwei instead of Wei.
As difficulty/totalDifficulty is slightly smaller than values of transaction we use the divisor 1000000, i.e. we store `float(totalDifficulty / 1000000)` and `float(difficulty / 1000000)`.

## Unit Tests

To run all unit tests do `npm run test`.


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
elasticdump --input=http://localhost:9200/.kibana --output=http://target-server.tld:9200/.kibana --type=data --searchBody='{"filter": { "or": [ {"type": {"value": "dashboard"}}, {"type" : {"value":"visualization"}}] }}'
```

## Ethereum RPC

* https://github.com/ethereum/wiki/wiki/JSON-RPC


## Alternative solutions

see https://github.com/nexusdev/elastic-ethereum
see https://github.com/ethereum/research/blob/master/uncle_regressions/block_datadump_generator.py

# Docker Support

This project can be run as a Docker container. To build the Docker image execute
```
docker build -t e2ebridge .
```
in the project root. You can then run a container via
```
docker run -d --link elstack --link geth --name e2eBridge e2ebridge:latest follow
```
Here, the command line argument `follow` is passed as the MODE parameter. If the Elasticsearch/Ethereum node do not run on the same machine you may want to specify an IP address like this:
```
docker run -d --env ELSTACK_PORT_9200_TCP_ADDR=22.33.44.55 --env GETH_PORT_8545_TCP_ADDR=11.22.33.44 --name e2eBridge e2ebridge:latest follow
```

**Watch out:** This container expects another container called `geth` which provides an JSON rpc interface on port `8545` and a container `elstack` which provides an Elasticsearch instance on port `9200`.
