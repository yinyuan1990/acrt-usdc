#!/usr/bin/env bash
# Quick look at indexer state.
Q='select symbol, volume_since_distribute as vol_since, last_distributed_at, launch_ts, graduated, paired_usdc from tokens order by launch_ts'
docker exec arclaunch-db psql -U arclaunch -d arclaunch -c "$Q"
docker exec arclaunch-db psql -U arclaunch -d arclaunch -c "select token, count(*) trades, sum(usdc) vol from trades group by token"
docker exec arclaunch-db psql -U arclaunch -d arclaunch -c "select token, ts, quote_creator, quote_protocol, creator_paid from fee_events order by ts"
docker logs arclaunch-indexer 2>&1 | grep -E 'keeper' | tail -n 8
