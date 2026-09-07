#!/usr/bin/env bash
# Mainnet: the client launches the platform token through the site, then we point the Treasury at it. Write-once —
# after this call there is nothing left on the contracts that changes where money goes (ecoFund / feeRecipient /
# locker.treasury are immutable, set at deploy via ECO_FUND).
# Usage: PLATFORM_TOKEN=0x… [DEPLOYMENTS=arc-mainnet] bash ops/set-platform-token.sh
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd /opt/arclaunch/contracts
set -a; . /opt/arclaunch/.env; set +a
DEP="deployments/${DEPLOYMENTS:-arc-testnet}.json"
FACTORY=$(python3 -c "import json; print(json.load(open('$DEP'))['launchFactory'])")
TREASURY=$(python3 -c "import json; print(json.load(open('$DEP'))['treasury'])")
[ -n "$PLATFORM_TOKEN" ] || { echo "PLATFORM_TOKEN=0x… required"; exit 1; }
CALL="cast call --rpc-url $ARC_RPC_URL"

# sanity: the token must be one of ours (has a lock in the factory) so the 1% pool exists
EXISTS=$($CALL "$FACTORY" 'launches(address)(address,address,address,uint256,bool,uint256,uint256,uint256,uint256,bool,bool)' "$PLATFORM_TOKEN" | tail -n 1)
[ "$EXISTS" = "true" ] || { echo "token $PLATFORM_TOKEN was not launched through this factory"; exit 1; }

echo "ecoFund (immutable):      $($CALL "$TREASURY" 'ecoFund()(address)')"
echo "feeRecipient (immutable): $($CALL "$FACTORY" 'feeRecipient()(address)')"
CUR=$($CALL "$TREASURY" 'platformToken()(address)')
if [ "$CUR" != "0x0000000000000000000000000000000000000000" ]; then echo "already configured: $CUR (write-once, cannot change)"; exit 1; fi

cast send --rpc-url "$ARC_RPC_URL" --private-key "$PRIVATE_KEY" --gas-price 25gwei --priority-gas-price 1gwei --json \
  "$TREASURY" 'configure(address,uint24)' "$PLATFORM_TOKEN" 10000 \
  | python3 -c 'import sys,json; r=json.load(sys.stdin); print("configure", r["status"], r["transactionHash"])'
echo "platformToken: $($CALL "$TREASURY" 'platformToken()(address)')"
grep -q '^PLATFORM_TOKEN=' /opt/arclaunch/.env || echo "PLATFORM_TOKEN=$PLATFORM_TOKEN" >> /opt/arclaunch/.env
