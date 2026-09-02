#!/usr/bin/env bash
# Deploy Uniswap V3 (official bytecode) + ArcLaunch contracts to Arc Testnet from the server.
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd /opt/arclaunch/contracts
set -a; . /opt/arclaunch/.env; set +a
echo "deployer: $DEPLOYER"
echo "balance:  $(cast balance "$DEPLOYER" --rpc-url "$ARC_RPC_URL" --ether) USDC"
mkdir -p deployments
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$ARC_RPC_URL" \
  --broadcast \
  --slow \
  --with-gas-price 25gwei \
  --priority-gas-price 1gwei \
  -vv 2>&1 | grep -vE '^\s*$' | tail -n 40
echo "---- deployments/arc-testnet.json ----"
cat deployments/arc-testnet.json
echo
echo "balance after: $(cast balance "$DEPLOYER" --rpc-url "$ARC_RPC_URL" --ether) USDC"
