#!/bin/bash

# possible values for class are
#  exchange
#

curl -XPUT 'http://localhost:9200/ethereum/address/0x2910543af39aba0cd09dbb2d50200b3e800a63d2' -d '{"comment" : "Kraken", "class" : "exchange"}';
curl -XPUT 'http://localhost:9200/ethereum/address/0x32be343b94f860124dc4fee278fdcbd38c102d88' -d '{"comment" : "Poloniex Wallet", "class" : "exchange"}';
curl -XPUT 'http://localhost:9200/ethereum/address/0xb794f5ea0ba39494ce839613fffba74279579268' -d '{"comment" : "Poloniex ColdWallet", "class" : "exchange"}';
