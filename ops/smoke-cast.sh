#!/usr/bin/env bash
# Live smoke test with `cast send` (forge script cannot simulate Arc's USDC blocklist precompile).
#   STEP=launch | trade TOKEN=0x.. | fees TOKEN=0x..
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd /opt/arclaunch/contracts
set -a; . /opt/arclaunch/.env; set +a
DEP=deployments/arc-testnet.json
j() { python3 -c "import json,sys; print(json.load(open('$DEP'))['$1'])"; }
FACTORY=$(j launchFactory); LOCKER=$(j feeLocker); ROUTER=$(j swapRouter); TREASURY=$(j treasury)
RPC="$ARC_RPC_URL"
SEND="cast send --rpc-url $RPC --private-key $PRIVATE_KEY --gas-price 25gwei --priority-gas-price 1gwei --json"
CALL="cast call --rpc-url $RPC"
STEP="${STEP:-launch}"

bal() { $CALL "$USDC" 'balanceOf(address)(uint256)' "$1" | awk '{print $1}'; }
echo "me: $DEPLOYER  usdc: $(bal "$DEPLOYER")"

if [ "$STEP" = "launch" ]; then
  MCAP=${MCAP_USDC:-5000000000}; FIRST=${FIRST_BUY:-3000000}
  NONCE=$($CALL --rpc-url "$RPC" 2>/dev/null; cast nonce --rpc-url "$RPC" "$FACTORY")
  PRED=$(cast compute-address --nonce "$NONCE" "$FACTORY" | awk '{print $NF}')
  IS0=$(python3 -c "print(int('$PRED',16) < int('$USDC',16))")
  SQRTP=$(python3 - "$MCAP" "$IS0" <<'PY'
import sys, math
M=int(sys.argv[1]); is0=sys.argv[2]=='True'; SCALE=10**27
def isqrt(n): return math.isqrt(n)
s = (isqrt((M<<128)//SCALE)<<32) if is0 else (isqrt((SCALE<<128)//M)<<32)
print(s)
PY
)
  echo "predicted token: $PRED  isToken0=$IS0  sqrtPriceX96=$SQRTP"
  FEE=$($CALL "$FACTORY" 'quoteCreationFee(address)(uint256)' "$DEPLOYER" | awk '{print $1}')
  NEED=$((FEE + FIRST))
  $SEND "$USDC" 'approve(address,uint256)' "$FACTORY" "$NEED" | python3 -c 'import sys,json; r=json.load(sys.stdin); print("approve", r["status"], r["transactionHash"])'
  NAME="${NAME:-Arc Cat}"; SYMBOL="${SYMBOL:-ACAT}"
  ARGS="(\"$NAME\",\"$SYMBOL\",\"https://launch.hzmrbq.com/logo/acat.png\",\"First cat on Arc. Smoke test token.\",(\"https://launch.hzmrbq.com\",\"https://x.com/arclaunch\",\"\"),$SQRTP,$FIRST,0)"
  $SEND "$FACTORY" 'launch((string,string,string,string,(string,string,string),uint160,uint256,uint256))' "$ARGS" \
    | python3 -c 'import sys,json; r=json.load(sys.stdin); print("launch", r["status"], r["transactionHash"], "gas", int(r["gasUsed"],16))'
  N=$($CALL "$FACTORY" 'totalLaunches()(uint256)' | awk '{print $1}')
  TOKEN=$($CALL "$FACTORY" 'allTokens(uint256)(address)' $((N-1)))
  POOL=$($CALL "$FACTORY" 'launches(address)(address,address,address,uint256,bool,uint256,uint256,uint256,uint256,bool,bool)' "$TOKEN" | sed -n '3p')
  echo "TOKEN=$TOKEN"
  echo "POOL=$POOL"
  echo "creator tokens: $($CALL "$TOKEN" 'balanceOf(address)(uint256)' "$DEPLOYER")"
  echo "pool tokens:    $($CALL "$TOKEN" 'balanceOf(address)(uint256)' "$POOL")"
  echo "pool usdc:      $(bal "$POOL")"
  echo "treasury usdc:  $(bal "$TREASURY")"
  echo "slot0:          $($CALL "$POOL" 'slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)' | head -2 | tr '\n' ' ')"

elif [ "$STEP" = "trade" ]; then
  : "${TOKEN:?TOKEN required}"; BUY=${BUY_USDC:-2000000}
  $SEND "$USDC" 'approve(address,uint256)' "$ROUTER" "$BUY" >/dev/null
  DL=$(( $(date +%s) + 600 ))
  $SEND "$ROUTER" 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))' "($USDC,$TOKEN,10000,$DEPLOYER,$DL,$BUY,0,0)" \
    | python3 -c 'import sys,json; r=json.load(sys.stdin); print("buy", r["status"], r["transactionHash"])'
  TB=$($CALL "$TOKEN" 'balanceOf(address)(uint256)' "$DEPLOYER" | awk '{print $1}')
  HALF=$(python3 -c "print($TB // 2)")
  $SEND "$TOKEN" 'approve(address,uint256)' "$ROUTER" "$HALF" >/dev/null
  $SEND "$ROUTER" 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))' "($TOKEN,$USDC,10000,$DEPLOYER,$DL,$HALF,0,0)" \
    | python3 -c 'import sys,json; r=json.load(sys.stdin); print("sell", r["status"], r["transactionHash"])'
  echo "my tokens now: $($CALL "$TOKEN" 'balanceOf(address)(uint256)' "$DEPLOYER")"
  echo "graduation (paired, threshold, graduated): $($CALL "$FACTORY" 'graduationStatus(address)(uint256,uint256,bool)' "$TOKEN" | tr '\n' ' ')"

elif [ "$STEP" = "fees" ]; then
  : "${TOKEN:?TOKEN required}"
  echo "pendingOwed (token, usdc): $($CALL "$LOCKER" 'pendingOwed(address)(uint256,uint256)' "$TOKEN" | tr '\n' ' ')"
  ME0=$(bal "$DEPLOYER"); TR0=$(bal "$TREASURY")
  $SEND "$LOCKER" 'distribute(address)(uint256,uint256)' "$TOKEN" | python3 -c 'import sys,json; r=json.load(sys.stdin); print("distribute", r["status"], r["transactionHash"], "logs", len(r["logs"]))'
  echo "creator  +usdc: $(( $(bal "$DEPLOYER") - ME0 ))"
  echo "treasury +usdc: $(( $(bal "$TREASURY") - TR0 ))"
  echo "claimable(creator, usdc): $($CALL "$LOCKER" 'claimable(address,address)(uint256)' "$DEPLOYER" "$USDC")"
fi
echo "usdc left: $(bal "$DEPLOYER")"
