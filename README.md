

## Discovery with kibana

Search for contract creating transactions:
```_type:transaction AND blockNumber:[0 TO 1900000] AND NOT to:*```


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


# Alternative solutions

see https://github.com/nexusdev/elastic-ethereum