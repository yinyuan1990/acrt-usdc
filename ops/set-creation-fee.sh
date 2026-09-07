#!/usr/bin/env bash
# Set the platform creation fee (USDC, 6dp) on the live factory. Usage: FEE=1000000 ENABLED=true bash ops/set-creation-fee.sh
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd /opt/arclaunch/contracts
set -a; . /opt/arclaunch/.env; set +a
FACTORY=$(python3 -c "import json; print(json.load(open('deployments/arc-testnet.json'))['launchFactory'])")
FEE=${FEE:-1000000}; ENABLED=${ENABLED:-true}
echo "before: $(cast call --rpc-url "$ARC_RPC_URL" "$FACTORY" 'creationFee()(uint256)') enabled=$(cast call --rpc-url "$ARC_RPC_URL" "$FACTORY" 'creationFeeEnabled()(bool)')"
cast send --rpc-url "$ARC_RPC_URL" --private-key "$PRIVATE_KEY" --gas-price 25gwei --priority-gas-price 1gwei --json \
  "$FACTORY" 'setCreationFee(uint256,bool)' "$FEE" "$ENABLED" \
  | python3 -c 'import sys,json; r=json.load(sys.stdin); print("setCreationFee", r["status"], r["transactionHash"])'
echo "after:  $(cast call --rpc-url "$ARC_RPC_URL" "$FACTORY" 'creationFee()(uint256)') enabled=$(cast call --rpc-url "$ARC_RPC_URL" "$FACTORY" 'creationFeeEnabled()(bool)')"
