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

# Ecosystem multisig (80% of protocol revenue + every creation fee) is immutable, fixed at deploy via ECO_FUND.
echo "ecoFund (immutable): $($CALL "$TREASURY" 'ecoFund()(address)')  feeRecipient (immutable): $($CALL "$FACTORY" 'feeRecipient()(address)')"

if [ -z "${PLATFORM_TOKEN:-}" ]; then
  MCAP=${MCAP_USDC:-10000000000}   # $10,000 start mcap for the platform token
  FIRST=${FIRST_BUY:-2000000}      # 2 USDC first buy
  # The opening mcap is a platform-wide parameter (fair launch). To give ARCL its own opening mcap the
  # admin raises the parameter just for this launch and restores it right after.
  CUR_MCAP=$($CALL "$FACTORY" 'startMcapUsdc()(uint256)' | awk '{print $1}')
  THR=$($CALL "$FACTORY" 'graduationThreshold()(uint256)' | awk '{print $1}')
  PROT=$($CALL "$FACTORY" 'protectionBlocks()(uint256)' | awk '{print $1}')
  HOLD=$($CALL "$FACTORY" 'maxHoldBps()(uint16)' | awk '{print $1}')
  BUYCAP=$($CALL "$FACTORY" 'maxBuyBps()(uint16)' | awk '{print $1}')
  if [ "$CUR_MCAP" != "$MCAP" ]; then
    $SEND "$FACTORY" 'setLaunchParams(uint256,uint256,uint16,uint16,uint256)' "$THR" "$PROT" "$HOLD" "$BUYCAP" "$MCAP" >/dev/null
    echo "start mcap temporarily set to $MCAP (was $CUR_MCAP)"
  fi

  FEE=$($CALL "$FACTORY" 'quoteCreationFee(address)(uint256)' "$DEPLOYER" | awk '{print $1}')
  $SEND "$USDC" 'approve(address,uint256)' "$FACTORY" $((FEE + FIRST)) >/dev/null
  ZERO=0x0000000000000000000000000000000000000000
  ARGS="(\"ArcLaunch\",\"ARCL\",\"https://arclaunch.top/brand/arcl.png\",\"ArcLaunch platform token. 20% of protocol revenue buys and burns ARCL every 7 days; 80% funds the ecosystem.\",(\"https://arclaunch.top\",\"https://x.com/arclaunch_\",\"https://t.me/ArcLaunchCommunity\",\"\",\"\"),$ZERO,0,0,$ZERO,$ZERO,0,$FIRST,0)"
  $SEND "$FACTORY" 'launch((string,string,string,string,(string,string,string,string,string),address,uint16,uint16,address,address,uint16,uint256,uint256))' "$ARGS" \
    | python3 -c 'import sys,json; r=json.load(sys.stdin); print("launch ARCL", r["status"], r["transactionHash"])'

  if [ "$CUR_MCAP" != "$MCAP" ]; then
    $SEND "$FACTORY" 'setLaunchParams(uint256,uint256,uint16,uint16,uint256)' "$THR" "$PROT" "$HOLD" "$BUYCAP" "$CUR_MCAP" >/dev/null
    echo "start mcap restored to $CUR_MCAP"
  fi

  N=$($CALL "$FACTORY" 'totalLaunches()(uint256)' | awk '{print $1}')
  PLATFORM_TOKEN=$($CALL "$FACTORY" 'allTokens(uint256)(address)' $((N-1)))
  echo "PLATFORM_TOKEN=$PLATFORM_TOKEN" >> /opt/arclaunch/.env
fi
echo "PLATFORM_TOKEN=$PLATFORM_TOKEN"

# Treasury wiring: write-once platform token. 80% eco / 20% buyback, the 7-day cadence and ecoFund are immutable.
CUR_PT=$($CALL "$TREASURY" 'platformToken()(address)')
if [ "$CUR_PT" = "0x0000000000000000000000000000000000000000" ]; then
  $SEND "$TREASURY" 'configure(address,uint24)' "$PLATFORM_TOKEN" 10000 \
    | python3 -c 'import sys,json; r=json.load(sys.stdin); print("configure", r["status"], r["transactionHash"])'
else
  echo "treasury already configured with $CUR_PT (write-once)"
fi
echo "treasury usdc: $(bal "$TREASURY")  ecoFund: $($CALL "$TREASURY" 'ecoFund()(address)')  feeRecipient: $($CALL "$FACTORY" 'feeRecipient()(address)')  platformToken: $($CALL "$TREASURY" 'platformToken()(address)')"
