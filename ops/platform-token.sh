#!/usr/bin/env bash
# Launch the platform token ($ARCL) through our own factory and wire the Treasury buyback.
# Idempotent: skips launch if PLATFORM_TOKEN already recorded in .env.
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd /opt/arclaunch/contracts
set -a; . /opt/arclaunch/.env; set +a
DEP=deployments/arc-testnet.json
j() { python3 -c "import json; print(json.load(open('$DEP'))['$1'])"; }
FACTORY=$(j launchFactory); TREASURY=$(j treasury); RPC="$ARC_RPC_URL"
SEND="cast send --rpc-url $RPC --private-key $PRIVATE_KEY --gas-price 25gwei --priority-gas-price 1gwei --json"
CALL="cast call --rpc-url $RPC"
bal() { $CALL "$USDC" 'balanceOf(address)(uint256)' "$1" | awk '{print $1}'; }

if [ -z "${PLATFORM_TOKEN:-}" ]; then
  MCAP=${MCAP_USDC:-10000000000}   # $10,000 start mcap
  FIRST=${FIRST_BUY:-2000000}      # 2 USDC first buy
  NONCE=$(cast nonce --rpc-url "$RPC" "$FACTORY")
  PRED=$(cast compute-address --nonce "$NONCE" "$FACTORY" | awk '{print $NF}')
  IS0=$(python3 -c "print(int('$PRED',16) < int('$USDC',16))")
  SQRTP=$(python3 - "$MCAP" "$IS0" <<'PY'
import sys, math
M=int(sys.argv[1]); is0=sys.argv[2]=='True'; SCALE=10**27
print((math.isqrt((M<<128)//SCALE)<<32) if is0 else (math.isqrt((SCALE<<128)//M)<<32))
PY
)
  FEE=$($CALL "$FACTORY" 'quoteCreationFee(address)(uint256)' "$DEPLOYER" | awk '{print $1}')
  $SEND "$USDC" 'approve(address,uint256)' "$FACTORY" $((FEE + FIRST)) >/dev/null
  ARGS="(\"ArcLaunch\",\"ARCL\",\"https://launch.hzmrbq.com/arcl.png\",\"ArcLaunch platform token. 82% of treasury revenue buys and burns ARCL; 18% funds the ecosystem.\",(\"https://launch.hzmrbq.com\",\"https://x.com/arclaunch\",\"\"),$SQRTP,$FIRST,0)"
  $SEND "$FACTORY" 'launch((string,string,string,string,(string,string,string),uint160,uint256,uint256))' "$ARGS" \
    | python3 -c 'import sys,json; r=json.load(sys.stdin); print("launch ARCL", r["status"], r["transactionHash"])'
  N=$($CALL "$FACTORY" 'totalLaunches()(uint256)' | awk '{print $1}')
  PLATFORM_TOKEN=$($CALL "$FACTORY" 'allTokens(uint256)(address)' $((N-1)))
  echo "PLATFORM_TOKEN=$PLATFORM_TOKEN" >> /opt/arclaunch/.env
  [ "$PLATFORM_TOKEN" = "$PRED" ] && echo "predicted ok" || echo "WARN predicted mismatch $PRED"
fi
echo "PLATFORM_TOKEN=$PLATFORM_TOKEN"

# Treasury wiring: 82/18 split is immutable; these are the operational params.
ECO=${ECO_FUND:-$DEPLOYER}
THRESHOLD=${EXEC_THRESHOLD:-5000000}     # 5 USDC (testnet); mainnet 50,000 USDC
MAXPER=${EXEC_MAX:-2000000}              # 2 USDC per execute (TWAP slice)
$SEND "$TREASURY" 'configure(address,uint24,address,uint256,uint256)' "$PLATFORM_TOKEN" 10000 "$ECO" "$THRESHOLD" "$MAXPER" \
  | python3 -c 'import sys,json; r=json.load(sys.stdin); print("configure", r["status"], r["transactionHash"])'
echo "treasury usdc: $(bal "$TREASURY")  threshold: $($CALL "$TREASURY" 'executeThreshold()(uint256)')  platformToken: $($CALL "$TREASURY" 'platformToken()(address)')"
