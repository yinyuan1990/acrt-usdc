import { getAddress, parseEventLogs, type Address, type Log } from "viem";
import { client, ADDR } from "./chain.js";
import { config } from "./config.js";
import { sql, getSync, setSync } from "./db.js";
import { factoryAbi, lockerAbi, poolAbi, tokenAbi, treasuryAbi } from "./abi.js";
import { mcapFromSqrtPriceX96, priceUsdFromMcap6 } from "./price.js";
import { bus } from "./bus.js";

type TokenRow = { address: string; pool: string; is_token0: boolean; deployer: string; payout: string };

const TRANSFER_EVENT = tokenAbi.find((x) => x.type === "event" && x.name === "Transfer")!;

const tokens = new Map<string, TokenRow>(); // lowercase address → row
const poolToToken = new Map<string, string>(); // lowercase pool → token
const blockTs = new Map<bigint, Date>();

async function loadKnown() {
  const rows = await sql<TokenRow[]>`select address, pool, is_token0, deployer, payout from tokens`;
  for (const r of rows) {
    tokens.set(r.address.toLowerCase(), r);
    poolToToken.set(r.pool.toLowerCase(), r.address);
  }
}

async function tsOf(block: bigint): Promise<Date> {
  const hit = blockTs.get(block);
  if (hit) return hit;
  const b = await client.getBlock({ blockNumber: block });
  const d = new Date(Number(b.timestamp) * 1000);
  blockTs.set(block, d);
  if (blockTs.size > 5000) blockTs.delete(blockTs.keys().next().value!);
  return d;
}

// ------------------------------------------------------------------ handlers

async function onTokenLaunched(log: Log, args: {
  token: Address; deployer: Address; pool: Address; positionId: bigint; isToken0: boolean;
  restrictionsEndBlock: bigint; graduationThreshold: bigint; initialBuyUsdc: bigint; creationFeePaid: bigint;
}) {
  const token = getAddress(args.token);
  if (tokens.has(token.toLowerCase())) return;
  const [name, symbol, logo, description, socials, lock, tax] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: token, abi: tokenAbi, functionName: "name" },
      { address: token, abi: tokenAbi, functionName: "symbol" },
      { address: token, abi: tokenAbi, functionName: "logo" },
      { address: token, abi: tokenAbi, functionName: "description" },
      { address: token, abi: tokenAbi, functionName: "socials" },
      // the creator may pick a separate fee wallet at launch; the locker is the source of truth for payout
      { address: ADDR.locker, abi: lockerAbi, functionName: "locks", args: [token] },
      // tax mode: immutable on the token
      { address: token, abi: tokenAbi, functionName: "taxConfig" },
    ],
  });
  const [buyTax, sellTax, taxMarketing, taxTeam, taxMarketingBps] = tax;
  const ts = await tsOf(log.blockNumber!);
  const payout = lock[5] !== "0x0000000000000000000000000000000000000000" ? getAddress(lock[5]) : getAddress(args.deployer);
  const row: TokenRow = { address: token, pool: getAddress(args.pool), is_token0: args.isToken0, deployer: getAddress(args.deployer), payout };
  await sql`insert into tokens (address, name, symbol, logo, description, website, twitter, telegram, discord, farcaster, deployer, payout, pool, position_id,
      is_token0, launch_block, launch_ts, launch_tx, restrictions_end_block, graduation_threshold, initial_buy_usdc, creation_fee_paid,
      buy_tax_bps, sell_tax_bps, tax_marketing_wallet, tax_team_wallet, tax_marketing_bps)
    values (${token}, ${name}, ${symbol}, ${logo}, ${description}, ${socials[0]}, ${socials[1]}, ${socials[2]}, ${socials[3]}, ${socials[4]}, ${row.deployer}, ${row.payout},
      ${row.pool}, ${args.positionId.toString()}, ${args.isToken0}, ${Number(log.blockNumber)}, ${ts}, ${log.transactionHash!},
      ${Number(args.restrictionsEndBlock)}, ${args.graduationThreshold.toString()}, ${args.initialBuyUsdc.toString()}, ${args.creationFeePaid.toString()},
      ${Number(buyTax)}, ${Number(sellTax)}, ${buyTax > 0 || sellTax > 0 ? getAddress(taxMarketing) : ""}, ${buyTax > 0 || sellTax > 0 ? getAddress(taxTeam) : ""}, ${Number(taxMarketingBps)})
    on conflict (address) do nothing`;
  tokens.set(token.toLowerCase(), row);
  poolToToken.set(row.pool.toLowerCase(), token);
  bus.emit("ws", { type: "launch", data: { token, symbol, name, deployer: row.deployer, ts } });
  console.log(`[launch] ${symbol} ${token} pool=${row.pool}`);
}

async function onSwap(log: Log, args: { sender: Address; recipient: Address; amount0: bigint; amount1: bigint; sqrtPriceX96: bigint; liquidity: bigint; tick: number }) {
  const token = poolToToken.get(log.address.toLowerCase());
  if (!token) return;
  const t = tokens.get(token.toLowerCase())!;
  const usdcDelta = t.is_token0 ? args.amount1 : args.amount0; // + = USDC into pool = buy
  const tokDelta = t.is_token0 ? args.amount0 : args.amount1;
  const side = usdcDelta > 0n ? "buy" : "sell";
  const usdc = usdcDelta < 0n ? -usdcDelta : usdcDelta;
  const toks = tokDelta < 0n ? -tokDelta : tokDelta;
  const mcap6 = mcapFromSqrtPriceX96(args.sqrtPriceX96, t.is_token0);
  const price = priceUsdFromMcap6(mcap6);
  const ts = await tsOf(log.blockNumber!);

  const inserted = await sql`insert into trades (token, pool, tx_hash, log_index, block_number, ts, side, usdc, tokens, price, mcap6, sender, recipient)
    values (${token}, ${getAddress(log.address)}, ${log.transactionHash!}, ${log.logIndex!}, ${Number(log.blockNumber)}, ${ts}, ${side},
      ${usdc.toString()}, ${toks.toString()}, ${price}, ${mcap6.toString()}, ${getAddress(args.sender)}, ${getAddress(args.recipient)})
    on conflict (tx_hash, log_index) do nothing returning id`;
  if (inserted.length === 0) return;

  const bucket = new Date(Math.floor(ts.getTime() / 60_000) * 60_000);
  await sql`insert into candles (token, bucket_ts, open, high, low, close, volume_usdc, trades)
    values (${token}, ${bucket}, ${price}, ${price}, ${price}, ${price}, ${usdc.toString()}, 1)
    on conflict (token, bucket_ts) do update set
      high = greatest(candles.high, excluded.high),
      low = least(candles.low, excluded.low),
      close = excluded.close,
      volume_usdc = candles.volume_usdc + excluded.volume_usdc,
      trades = candles.trades + 1`;
  await sql`update tokens set last_price = ${price}, last_mcap6 = ${mcap6.toString()},
      volume_since_distribute = volume_since_distribute + ${usdc.toString()}, updated_at = now() where address = ${token}`;

  bus.emit("ws", { type: "trade", data: { token, side, usdc: usdc.toString(), tokens: toks.toString(), price, mcap6: mcap6.toString(), wallet: getAddress(args.recipient), tx: log.transactionHash, ts } });
}

async function onTransfer(log: Log, args: { from: Address; to: Address; value: bigint }) {
  const token = tokens.get(log.address.toLowerCase());
  if (!token || args.value === 0n) return;
  const v = args.value.toString();
  const zero = "0x0000000000000000000000000000000000000000";
  if (args.from.toLowerCase() !== zero) {
    await sql`insert into holders (token, address, balance) values (${token.address}, ${getAddress(args.from)}, ${"-" + v})
      on conflict (token, address) do update set balance = holders.balance + excluded.balance`;
  }
  if (args.to.toLowerCase() !== zero) {
    await sql`insert into holders (token, address, balance) values (${token.address}, ${getAddress(args.to)}, ${v})
      on conflict (token, address) do update set balance = holders.balance + excluded.balance`;
  }
}

async function onFees(log: Log, args: { token: Address; quoteToCreator: bigint; quoteToProtocol: bigint; tokenConverted: bigint; usdcFromToken: bigint; creatorPaid: boolean }) {
  const token = getAddress(args.token);
  const t = tokens.get(token.toLowerCase());
  const ts = await tsOf(log.blockNumber!);
  // quote_* already include the USDC obtained by selling the token-side fees (payouts are USDC-only)
  const ins = await sql`insert into fee_events (token, tx_hash, log_index, block_number, ts, quote_creator, quote_protocol, token_converted, usdc_from_token, creator_paid, payout)
    values (${token}, ${log.transactionHash!}, ${log.logIndex!}, ${Number(log.blockNumber)}, ${ts}, ${args.quoteToCreator.toString()}, ${args.quoteToProtocol.toString()},
      ${args.tokenConverted.toString()}, ${args.usdcFromToken.toString()}, ${args.creatorPaid}, ${t?.payout ?? ""})
    on conflict (tx_hash, log_index, kind) do nothing returning id`;
  if (ins.length === 0) return;
  const total = args.quoteToCreator + args.quoteToProtocol;
  await sql`update tokens set fees_usdc_total = fees_usdc_total + ${total.toString()},
      fees_creator_usdc_total = fees_creator_usdc_total + ${args.quoteToCreator.toString()},
      last_distributed_at = ${ts}, volume_since_distribute = 0, updated_at = now() where address = ${token}`;
  bus.emit("ws", { type: "fees", data: { token, quoteToCreator: args.quoteToCreator.toString(), quoteToProtocol: args.quoteToProtocol.toString(), creatorPaid: args.creatorPaid, ts } });
}

/** Tax proceeds paid inside the same distribute() call to the token's two tax wallets → one payout row each. */
async function onTaxDistributed(log: Log, args: {
  token: Address; tokenConverted: bigint; marketingWallet: Address; usdcToMarketing: bigint; teamWallet: Address; usdcToTeam: bigint; allPaid: boolean;
}) {
  const token = getAddress(args.token);
  const ts = await tsOf(log.blockNumber!);
  const rows: [string, Address, bigint][] = [["tax_marketing", args.marketingWallet, args.usdcToMarketing], ["tax_team", args.teamWallet, args.usdcToTeam]];
  let inserted = 0n;
  for (const [kind, wallet, amt] of rows) {
    if (amt === 0n) continue;
    const ins = await sql`insert into fee_events (token, tx_hash, log_index, block_number, ts, quote_creator, quote_protocol, token_converted, usdc_from_token, creator_paid, payout, kind)
      values (${token}, ${log.transactionHash!}, ${log.logIndex!}, ${Number(log.blockNumber)}, ${ts}, ${amt.toString()}, 0,
        ${args.tokenConverted.toString()}, ${amt.toString()}, ${args.allPaid}, ${getAddress(wallet)}, ${kind})
      on conflict (tx_hash, log_index, kind) do nothing returning id`;
    if (ins.length) inserted += amt;
  }
  if (inserted === 0n) return;
  await sql`update tokens set tax_usdc_total = tax_usdc_total + ${inserted.toString()}, updated_at = now() where address = ${token}`;
  bus.emit("ws", { type: "fees", data: { token, kind: "tax", quoteToCreator: inserted.toString(), quoteToProtocol: "0", creatorPaid: args.allPaid, ts } });
}

async function onGraduated(log: Log, args: { token: Address; pairedUsdc: bigint; threshold: bigint }) {
  const token = getAddress(args.token);
  const ts = await tsOf(log.blockNumber!);
  await sql`update tokens set graduated = true, graduated_at = coalesce(graduated_at, ${ts}), paired_usdc = ${args.pairedUsdc.toString()} where address = ${token}`;
  bus.emit("ws", { type: "graduated", data: { token, pairedUsdc: args.pairedUsdc.toString(), ts } });
  console.log(`[graduated] ${token}`);
}

async function onPayoutChanged(args: { token: Address; newPayout: Address }) {
  const token = getAddress(args.token);
  await sql`update tokens set payout = ${getAddress(args.newPayout)} where address = ${token}`;
  const t = tokens.get(token.toLowerCase());
  if (t) t.payout = getAddress(args.newPayout);
}

/** Weekly treasury settlement (eco transfer + first buyback slice) and standalone buyback slices (`BoughtBack`,
 *  usdcToEco = 0). Both land in `burns`. */
async function onExecuted(log: Log, args: { usdcToEco?: bigint; usdcToDev?: bigint; usdcSpent: bigint; tokensBurned: bigint; reserveLeft: bigint }) {
  const ts = await tsOf(log.blockNumber!);
  const toEco = args.usdcToEco ?? 0n;
  const toDev = args.usdcToDev ?? 0n;
  const ins = await sql`insert into burns (tx_hash, block_number, ts, usdc_spent, tokens_burned, usdc_to_eco, usdc_to_dev)
    values (${log.transactionHash!}, ${Number(log.blockNumber)}, ${ts}, ${args.usdcSpent.toString()}, ${args.tokensBurned.toString()}, ${toEco.toString()}, ${toDev.toString()})
    on conflict (tx_hash) do nothing returning id`;
  if (ins.length === 0) return;
  bus.emit("ws", { type: "burn", data: { tx: log.transactionHash, usdcSpent: args.usdcSpent.toString(), tokensBurned: args.tokensBurned.toString(), usdcToEco: toEco.toString(), usdcToDev: toDev.toString(), ts } });
  console.log(`[treasury] eco ${toEco} · dev ${toDev} · spent ${args.usdcSpent} usdc → burned ${args.tokensBurned} · reserve ${args.reserveLeft}`);
}

async function onClaimed(log: Log, args: { account: Address; asset: Address; amount: bigint }) {
  const ts = await tsOf(log.blockNumber!);
  await sql`insert into claims (account, asset, amount, tx_hash, ts) values (${getAddress(args.account)}, ${getAddress(args.asset)}, ${args.amount.toString()}, ${log.transactionHash!}, ${ts})
    on conflict do nothing`;
}

// ------------------------------------------------------------------ range processing

type Typed = { log: Log; kind: string; args: unknown };

async function processRange(from: bigint, to: bigint) {
  // 1) protocol contracts (fixed addresses). Register launches first so their pools/tokens are known
  //    for the same range (the launch tx's own Swap has a lower logIndex than TokenLaunched).
  const protoLogs = await client.getLogs({ address: [ADDR.factory, ADDR.locker, ADDR.treasury], fromBlock: from, toBlock: to });
  const fLogs = parseEventLogs({ abi: factoryAbi, logs: protoLogs.filter((l) => l.address.toLowerCase() === ADDR.factory.toLowerCase()), strict: false });
  const lLogs = parseEventLogs({ abi: lockerAbi, logs: protoLogs.filter((l) => l.address.toLowerCase() === ADDR.locker.toLowerCase()), strict: false });
  const tLogs = parseEventLogs({ abi: treasuryAbi, logs: protoLogs.filter((l) => l.address.toLowerCase() === ADDR.treasury.toLowerCase()), strict: false });
  for (const l of fLogs) if (l.eventName === "TokenLaunched") await onTokenLaunched(l, l.args as never);

  // 2) gather every other event and replay strictly in chain order so counters like
  //    volume_since_distribute are reset/accumulated exactly as they happened onchain.
  const all: Typed[] = [];
  for (const l of fLogs) if (l.eventName === "Graduated") all.push({ log: l, kind: "graduated", args: l.args });
  for (const l of tLogs) if (l.eventName === "Executed" || l.eventName === "BoughtBack") all.push({ log: l, kind: "executed", args: l.args });
  for (const l of lLogs) if (l.eventName === "FeesDistributed" || l.eventName === "TaxDistributed" || l.eventName === "PayoutChanged" || l.eventName === "Claimed") all.push({ log: l, kind: l.eventName, args: l.args });

  const pools = [...poolToToken.keys()] as Address[];
  const toks = [...tokens.keys()] as Address[];
  if (pools.length) {
    const swapLogs = await client.getLogs({ address: pools, event: poolAbi[0], fromBlock: from, toBlock: to });
    for (const l of swapLogs) all.push({ log: l, kind: "swap", args: l.args });
  }
  if (toks.length) {
    const xfer = await client.getLogs({ address: toks, event: TRANSFER_EVENT, fromBlock: from, toBlock: to });
    for (const l of xfer) all.push({ log: l, kind: "transfer", args: l.args });
  }
  all.sort((a, b) => (a.log.blockNumber === b.log.blockNumber ? Number(a.log.logIndex! - b.log.logIndex!) : Number(a.log.blockNumber! - b.log.blockNumber!)));

  for (const { log, kind, args } of all) {
    switch (kind) {
      case "swap": await onSwap(log, args as never); break;
      case "transfer": await onTransfer(log, args as never); break;
      case "FeesDistributed": await onFees(log, args as never); break;
      case "TaxDistributed": await onTaxDistributed(log, args as never); break;
      case "graduated": await onGraduated(log, args as never); break;
      case "executed": await onExecuted(log, args as never); break;
      case "PayoutChanged": await onPayoutChanged(args as never); break;
      case "Claimed": await onClaimed(log, args as never); break;
    }
  }
}

// ------------------------------------------------------------------ periodic on-chain refresh

export async function refreshOnchain() {
  const rows = await sql<{ address: string; graduated: boolean }[]>`select address, graduated from tokens`;
  if (rows.length === 0) return;
  const res = await client.multicall({
    allowFailure: true,
    contracts: rows.map((r) => ({ address: ADDR.factory, abi: factoryAbi, functionName: "graduationStatus" as const, args: [r.address as Address] })),
  });
  for (let i = 0; i < rows.length; i++) {
    const r = res[i];
    if (r.status !== "success") continue;
    const [paired, , graduated] = r.result as readonly [bigint, bigint, boolean];
    await sql`update tokens set paired_usdc = ${paired.toString()}, graduated = tokens.graduated or ${graduated} where address = ${rows[i].address}`;
  }
}

// ------------------------------------------------------------------ main loop

export async function startIndexer() {
  await loadKnown();
  let next = BigInt((await getSync("last_block")) ?? (config.startBlock - 1n).toString()) + 1n;
  console.log(`[indexer] ${tokens.size} tokens known, resuming from block ${next}`);

  for (;;) {
    try {
      const head = await client.getBlockNumber();
      while (next <= head) {
        const to = next + config.chunkSize - 1n > head ? head : next + config.chunkSize - 1n;
        await processRange(next, to);
        await setSync("last_block", to.toString());
        if (to - next > 50n) console.log(`[indexer] synced ${next}..${to} (head ${head})`);
        next = to + 1n;
      }
    } catch (e) {
      console.error("[indexer] error:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
    await new Promise((r) => setTimeout(r, config.pollMs));
  }
}
