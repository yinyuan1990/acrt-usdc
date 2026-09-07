import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAddress, isAddress, type Address } from "viem";
import { sql } from "./db.js";
import { client, ADDR, keeperWallet } from "./chain.js";
import { deployments, config } from "./config.js";
import { factoryAbi, lockerAbi, erc20Abi, treasuryAbi } from "./abi.js";
import { keeperState } from "./keeper-log.js";

export const app = new Hono();
app.use("*", cors());

const INTERVALS: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
const SUPPLY_TOKENS = 1_000_000_000;
const ZERO = "0x0000000000000000000000000000000000000000";
// Arc forbids transfers to address(0); burns go to the conventional dead address instead.
const DEAD = "0x000000000000000000000000000000000000dEaD";

function addr(a: string): Address {
  if (!isAddress(a)) throw new Error("bad address");
  return getAddress(a);
}

/** Shape a tokens row for the client (numerics as strings, add derived fields). */
function shapeToken(r: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const lastMcap6 = BigInt((r.last_mcap6 as string) ?? "0");
  return {
    address: r.address,
    name: r.name,
    symbol: r.symbol,
    logo: r.logo,
    description: r.description,
    socials: { website: r.website, twitter: r.twitter, telegram: r.telegram, discord: r.discord ?? "", farcaster: r.farcaster ?? "" },
    deployer: r.deployer,
    payout: r.payout,
    pool: r.pool,
    positionId: r.position_id,
    isToken0: r.is_token0,
    launchBlock: Number(r.launch_block),
    launchTs: r.launch_ts,
    launchTx: r.launch_tx,
    restrictionsEndBlock: Number(r.restrictions_end_block),
    graduationThreshold: r.graduation_threshold,
    pairedUsdc: r.paired_usdc,
    graduated: r.graduated,
    graduatedAt: r.graduated_at,
    creatorShareBps: r.creator_share_bps,
    price: Number(r.last_price),
    mcapUsd: Number(lastMcap6) / 1e6,
    feesUsdcTotal: r.fees_usdc_total,
    feesCreatorUsdcTotal: r.fees_creator_usdc_total,
    lastDistributedAt: r.last_distributed_at,
    // tax mode (0/0 = standard token); immutable on the token contract
    buyTaxBps: Number(r.buy_tax_bps ?? 0),
    sellTaxBps: Number(r.sell_tax_bps ?? 0),
    taxMarketingWallet: (r.tax_marketing_wallet as string) ?? "",
    taxTeamWallet: (r.tax_team_wallet as string) ?? "",
    taxMarketingBps: Number(r.tax_marketing_bps ?? 0),
    taxUsdcTotal: (r.tax_usdc_total as string) ?? "0",
    ...extra,
  };
}

app.get("/api/health", async (c) => {
  const [{ v }] = await sql`select value as v from sync_state where key = 'last_block'`.catch(() => [{ v: null }]);
  const head = await client.getBlockNumber().catch(() => null);
  return c.json({ ok: true, lastBlock: v ? Number(v) : null, head: head ? Number(head) : null, chainId: deployments.chainId });
});

app.get("/api/config", async (c) => {
  const [fee, thr, prot, maxHold, maxBuy, startMcap, total, maxTax] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: ADDR.factory, abi: factoryAbi, functionName: "creationFee" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "graduationThreshold" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "protectionBlocks" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "maxHoldBps" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "maxBuyBps" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "startMcapUsdc" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "totalLaunches" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "maxTaxBps" },
    ],
  });
  return c.json({
    chainId: deployments.chainId,
    addresses: deployments,
    params: {
      creationFee: fee.toString(), // constant 1 USDC
      graduationThreshold: thr.toString(),
      protectionBlocks: Number(prot),
      maxHoldBps: maxHold,
      maxBuyBps: maxBuy,
      startMcapUsdc: startMcap.toString(),
      creatorShareBps: 7500,
      poolFee: 10000,
      totalLaunches: Number(total),
      maxTaxBps: Number(maxTax),
    },
  });
});

/** Helper for the create form: the platform opening mcap and the (constant) creation fee. The opening price is
 *  fixed by the factory (fair launch) — the form cannot choose it. Token addresses are CREATE2 with the previous
 *  block hash in the salt, so they cannot be predicted ahead of the launch transaction. */
app.get("/api/launch-quote", async (c) => {
  const [startMcap, fee] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: ADDR.factory, abi: factoryAbi, functionName: "startMcapUsdc" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "creationFee" },
    ],
  });
  return c.json({ startMcapUsdc: startMcap.toString(), creationFee: fee.toString() });
});

app.get("/api/stats", async (c) => {
  const [s] = await sql`select
      (select count(*) from tokens) as tokens,
      (select count(*) from tokens where launch_ts > now() - interval '24 hours') as launched_24h,
      (select count(*) from tokens where graduated) as graduated,
      (select coalesce(sum(usdc),0) from trades where ts > now() - interval '24 hours') as volume_24h,
      (select coalesce(sum(usdc),0) from trades) as volume_total,
      (select coalesce(sum(quote_creator + quote_protocol),0) from fee_events) as fees_total,
      (select coalesce(sum(quote_creator + quote_protocol),0) from fee_events where ts > now() - interval '24 hours') as fees_24h,
      (select coalesce(sum(creation_fee_paid),0) from tokens) as creation_fees_total,
      (select coalesce(sum(quote_protocol),0) from fee_events) as protocol_fees_total`;
  const treasuryUsdc = await client.readContract({ address: ADDR.usdc, abi: erc20Abi, functionName: "balanceOf", args: [ADDR.treasury] }).catch(() => 0n);
  return c.json({
    tokens: Number(s.tokens),
    launched24h: Number(s.launched_24h),
    graduated: Number(s.graduated),
    volume24hUsdc: s.volume_24h,
    volumeTotalUsdc: s.volume_total,
    fees24hUsdc: s.fees_24h,
    feesTotalUsdc: s.fees_total,
    creationFeesTotalUsdc: s.creation_fees_total,
    protocolFeesTotalUsdc: s.protocol_fees_total,
    treasuryUsdc: treasuryUsdc.toString(),
  });
});

/** Public protocol analytics (pons-style): latest completed UTC day vs all time, plus a 30-day daily series.
 *  Everything is derived from indexed onchain events; the factory address is the verifiable source. */
app.get("/api/analytics", async (c) => {
  const [d] = await sql`with day as (select (now() at time zone 'utc')::date - 1 as d)
    select
      (select d from day) as latest_day,
      (select coalesce(sum(usdc),0) from trades, day where (ts at time zone 'utc')::date = day.d) as day_volume,
      (select count(*) from trades, day where (ts at time zone 'utc')::date = day.d) as day_trades,
      (select count(distinct sender) from trades, day where (ts at time zone 'utc')::date = day.d) as day_traders,
      (select count(*) from tokens, day where (launch_ts at time zone 'utc')::date = day.d) as day_launches,
      (select coalesce(sum(quote_creator + quote_protocol),0) from fee_events, day where kind = 'fee' and (ts at time zone 'utc')::date = day.d) as day_fees,
      (select coalesce(sum(usdc),0) from trades) as all_volume,
      (select count(*) from trades) as all_trades,
      (select count(distinct sender) from trades) as all_traders,
      (select count(*) from tokens) as all_launches,
      (select count(*) from tokens where graduated) as all_graduated,
      (select coalesce(sum(quote_creator + quote_protocol),0) from fee_events where kind = 'fee') as all_fees,
      (select coalesce(sum(quote_creator),0) from fee_events where kind = 'fee') as all_fees_creator,
      (select coalesce(sum(creation_fee_paid),0) from tokens) as all_creation_fees,
      (select coalesce(sum(usdc_spent),0) from burns) as all_buyback,
      (select coalesce(sum(tokens_burned),0) from burns) as all_burned`;
  const daily = await sql`with days as (select generate_series(((now() at time zone 'utc')::date - 29), (now() at time zone 'utc')::date, '1 day')::date as d)
    select d,
      (select count(*) from tokens where (launch_ts at time zone 'utc')::date = d) as launches,
      (select coalesce(sum(usdc),0) from trades where (ts at time zone 'utc')::date = d) as volume,
      (select count(*) from trades where (ts at time zone 'utc')::date = d) as trades,
      (select coalesce(sum(quote_creator + quote_protocol),0) from fee_events where kind = 'fee' and (ts at time zone 'utc')::date = d) as fees
    from days order by d`;
  const dstr = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : String(x).slice(0, 10));
  return c.json({
    latestDay: dstr(d.latest_day),
    day: { volumeUsdc: String(d.day_volume), trades: Number(d.day_trades), traders: Number(d.day_traders), launches: Number(d.day_launches), feesUsdc: String(d.day_fees) },
    allTime: {
      volumeUsdc: String(d.all_volume), trades: Number(d.all_trades), traders: Number(d.all_traders), launches: Number(d.all_launches), graduated: Number(d.all_graduated),
      feesUsdc: String(d.all_fees), feesCreatorUsdc: String(d.all_fees_creator), creationFeesUsdc: String(d.all_creation_fees), buybackUsdc: String(d.all_buyback), burned: String(d.all_burned),
    },
    daily: daily.map((r) => ({ day: dstr(r.d), launches: Number(r.launches), volumeUsdc: String(r.volume), trades: Number(r.trades), feesUsdc: String(r.fees) })),
    source: { factory: ADDR.factory, locker: ADDR.locker, treasury: ADDR.treasury, chainId: deployments.chainId },
  });
});

app.get("/api/tokens", async (c) => {
  const sort = c.req.query("sort") ?? "volume";
  const filter = c.req.query("filter") ?? "all";
  // volume window for the "volume" sort and the `volumeUsdc` field: 24h (default) / 7d / all
  const window = c.req.query("window") ?? "24h";
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const where = filter === "graduated" ? sql`where t.graduated` : filter === "graduating" ? sql`where not t.graduated` : sql``;
  const windowWhere = window === "all" ? sql`` : window === "7d" ? sql`where ts > now() - interval '7 days'` : sql`where ts > now() - interval '24 hours'`;
  const order =
    sort === "new" ? sql`t.launch_ts desc`
    : sort === "oldest" ? sql`t.launch_ts asc`
    : sort === "mcap" ? sql`t.last_mcap6 desc`
    : sort === "progress" ? sql`(t.paired_usdc::numeric / nullif(t.graduation_threshold,0)) desc nulls last, t.launch_ts desc`
    : sql`w.volume desc nulls last, t.launch_ts desc`;
  const rows = await sql`
    select t.*, coalesce(v.volume_24h,0) as volume_24h, coalesce(v.trades_24h,0) as trades_24h, coalesce(h.holders,0) as holders,
           coalesce(w.volume,0) as volume_window, coalesce(w.trades,0) as trades_window, p.price_24h_ago
    from tokens t
    left join (select token, sum(usdc) as volume_24h, count(*) as trades_24h from trades where ts > now() - interval '24 hours' group by token) v on v.token = t.address
    left join (select token, sum(usdc) as volume, count(*) as trades from trades ${windowWhere} group by token) w on w.token = t.address
    left join (select token, count(*) as holders from holders where balance > 0 group by token) h on h.token = t.address
    left join lateral (select price as price_24h_ago from trades where token = t.address and ts <= now() - interval '24 hours' order by ts desc limit 1) p on true
    ${where}
    order by ${order}
    limit ${limit}`;
  return c.json(rows.map((r) => shapeToken(r, {
    volume24hUsdc: r.volume_24h,
    trades24h: Number(r.trades_24h),
    volumeUsdc: r.volume_window,
    tradesWindow: Number(r.trades_window),
    holders: Number(r.holders),
    change24h: r.price_24h_ago ? ((Number(r.last_price) - Number(r.price_24h_ago)) / Number(r.price_24h_ago)) * 100 : null,
  })));
});

app.get("/api/tokens/:address", async (c) => {
  const a = addr(c.req.param("address"));
  const [t] = await sql`select t.*, coalesce(v.volume_24h,0) as volume_24h, coalesce(v.trades_24h,0) as trades_24h, coalesce(h.holders,0) as holders, p.price_24h_ago
    from tokens t
    left join (select token, sum(usdc) as volume_24h, count(*) as trades_24h from trades where token = ${a} and ts > now() - interval '24 hours' group by token) v on v.token = t.address
    left join (select token, count(*) as holders from holders where token = ${a} and balance > 0 group by token) h on h.token = t.address
    left join lateral (select price as price_24h_ago from trades where token = t.address and ts <= now() - interval '24 hours' order by ts desc limit 1) p on true
    where t.address = ${a}`;
  if (!t) return c.json({ error: "not found" }, 404);
  const [poolUsdc, head, [bal]] = await Promise.all([
    client.readContract({ address: ADDR.usdc, abi: erc20Abi, functionName: "balanceOf", args: [t.pool as Address] }).catch(() => null),
    client.getBlockNumber(),
    // token side of the pool + burned supply, both from the indexed Transfer ledger
    sql`select
      coalesce((select balance from holders where token = ${a} and address = ${t.pool}), 0) as pool_tokens,
      coalesce((select balance from holders where token = ${a} and address = ${DEAD}), 0) as burned`,
  ]);
  const poolUsdcStr = poolUsdc?.toString() ?? (t.paired_usdc as string);
  const price = Number(t.last_price);
  const poolTokens = Number(bal.pool_tokens) / 1e18;
  const burned = Number(bal.burned) / 1e18;
  return c.json(shapeToken(t, {
    volume24hUsdc: t.volume_24h,
    trades24h: Number(t.trades_24h),
    holders: Number(t.holders),
    change24h: t.price_24h_ago ? ((Number(t.last_price) - Number(t.price_24h_ago)) / Number(t.price_24h_ago)) * 100 : null,
    poolUsdc: poolUsdcStr,
    poolTokens: bal.pool_tokens,
    // both sides of the locked position valued at the current price
    liquidityUsd: Number(poolUsdcStr) / 1e6 + poolTokens * price,
    burnedTokens: bal.burned,
    // fdv = price × full supply; mcap shown to users is burn-adjusted (price × circulating)
    fdvUsd: price * SUPPLY_TOKENS,
    circulatingMcapUsd: price * (SUPPLY_TOKENS - burned),
    protectionActive: Number(head) <= Number(t.restrictions_end_block),
    currentBlock: Number(head),
    supply: SUPPLY_TOKENS,
  }));
});

app.get("/api/tokens/:address/candles", async (c) => {
  const a = addr(c.req.param("address"));
  const interval = c.req.query("interval") ?? "1m";
  const secs = INTERVALS[interval] ?? 60;
  const limit = Math.min(Number(c.req.query("limit") ?? 300), 1000);
  // aggregate 1m candles into the requested bucket; open/close via first/last ordering
  const rows = await sql`
    with b as (
      select to_timestamp(floor(extract(epoch from bucket_ts) / ${secs}) * ${secs}) as bts, *
      from candles where token = ${a}
    ),
    agg as (
      select bts,
        (array_agg(open order by bucket_ts asc))[1] as open,
        max(high) as high, min(low) as low,
        (array_agg(close order by bucket_ts desc))[1] as close,
        sum(volume_usdc) as volume, sum(trades) as trades
      from b group by bts
    )
    select * from agg order by bts desc limit ${limit}`;
  return c.json(rows.reverse().map((r) => ({ time: Math.floor(new Date(r.bts).getTime() / 1000), open: r.open, high: r.high, low: r.low, close: r.close, volumeUsdc: r.volume, trades: Number(r.trades) })));
});

app.get("/api/tokens/:address/trades", async (c) => {
  const a = addr(c.req.param("address"));
  const limit = Math.min(Number(c.req.query("limit") ?? 60), 500);
  const rows = await sql`select tx_hash, log_index, block_number, ts, side, usdc, tokens, price, mcap6, sender, recipient from trades where token = ${a} order by ts desc, log_index desc limit ${limit}`;
  return c.json(rows.map((r) => ({ hash: r.tx_hash, time: r.ts, side: r.side, usdc: r.usdc, tokens: r.tokens, price: r.price, mcapUsd: Number(r.mcap6) / 1e6, wallet: r.recipient, block: Number(r.block_number) })));
});

app.get("/api/tokens/:address/holders", async (c) => {
  const a = addr(c.req.param("address"));
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 500);
  const [t] = await sql`select pool, deployer, payout from tokens where address = ${a}`;
  if (!t) return c.json({ error: "not found" }, 404);
  const rows = await sql`select address, balance from holders where token = ${a} and balance > 0 order by balance desc limit ${limit}`;
  const supply = config.SUPPLY;
  return c.json(rows.map((r) => {
    const bal = BigInt(r.balance);
    const label = r.address.toLowerCase() === t.pool.toLowerCase() ? "Pool (locked)"
      : r.address.toLowerCase() === t.deployer.toLowerCase() ? "Creator"
      : r.address.toLowerCase() === ADDR.treasury.toLowerCase() ? "Treasury"
      : r.address.toLowerCase() === DEAD.toLowerCase() ? "Burned"
      : r.address.toLowerCase() === ADDR.locker.toLowerCase() ? "FeeLocker" : undefined;
    return { wallet: r.address, balance: r.balance, pct: Number((bal * 1_000_000n) / supply) / 10_000, label };
  }));
});

app.get("/api/activity", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 40), 200);
  const trades = await sql`select tr.ts, tr.side, tr.usdc, tr.recipient as wallet, tr.tx_hash, t.address as token, t.symbol, t.logo
    from trades tr join tokens t on t.address = tr.token order by tr.ts desc limit ${limit}`;
  const launches = await sql`select launch_ts as ts, deployer as wallet, launch_tx as tx_hash, address as token, symbol, logo from tokens order by launch_ts desc limit ${limit}`;
  const items = [
    ...trades.map((r) => ({ kind: r.side, ts: r.ts, wallet: r.wallet, tx: r.tx_hash, token: r.token, symbol: r.symbol, logo: r.logo, usdc: r.usdc })),
    ...launches.map((r) => ({ kind: "launch", ts: r.ts, wallet: r.wallet, tx: r.tx_hash, token: r.token, symbol: r.symbol, logo: r.logo })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, limit);
  return c.json(items);
});

app.get("/api/creator/:address", async (c) => {
  const a = addr(c.req.param("address"));
  // tokens this wallet is involved in: deployer, fee payout, or one of the tax wallets
  const toks = await sql`select t.*, coalesce(v.volume_24h,0) as volume_24h from tokens t
    left join (select token, sum(usdc) as volume_24h from trades where ts > now() - interval '24 hours' group by token) v on v.token = t.address
    where t.deployer = ${a} or t.payout = ${a} or t.tax_marketing_wallet = ${a} or t.tax_team_wallet = ${a} order by t.launch_ts desc`;
  const payouts = await sql`select f.ts, f.tx_hash, f.quote_creator, f.usdc_from_token, f.creator_paid, f.kind, f.token, t.symbol, t.logo
    from fee_events f join tokens t on t.address = f.token where f.payout = ${a} and f.quote_creator > 0 order by f.ts desc limit 100`;
  const claimable = await client.readContract({ address: ADDR.locker, abi: lockerAbi, functionName: "claimable", args: [a, ADDR.usdc] }).catch(() => 0n);
  const [sums] = await sql`select coalesce(sum(quote_creator),0) as earned from fee_events where payout = ${a} and creator_paid`;
  const [pend] = await sql`select coalesce(sum(volume_since_distribute),0) as vol from tokens where payout = ${a}`;
  // live takeover proposals so the creator can see (and veto) them
  const pps = toks.length
    ? await client.multicall({ allowFailure: true, contracts: toks.map((t) => ({ address: ADDR.locker, abi: lockerAbi, functionName: "pendingPayout" as const, args: [t.address as Address] })) })
    : [];
  return c.json({
    address: a,
    tokens: toks.map((r, i) => {
      const pp = pps[i]?.result as readonly [Address, bigint] | undefined;
      return shapeToken(r, { volume24hUsdc: r.volume_24h, pendingPayout: pp && pp[0] !== ZERO ? { newPayout: pp[0], eta: Number(pp[1]) } : null });
    }),
    payouts: payouts.map((p) => ({ time: p.ts, hash: p.tx_hash, usdc: p.quote_creator, usdcFromToken: p.usdc_from_token, paid: p.creator_paid, kind: p.kind, token: p.token, symbol: p.symbol, logo: p.logo })),
    earnedUsdc: sums.earned,
    pendingEstimateUsdc: ((BigInt(pend.vol) * 75n) / 10_000n).toString(), // 1% fee × 75%
    claimableUsdc: claimable.toString(),
  });
});

app.get("/api/treasury", async (c) => {
  const [s] = await sql`select coalesce(sum(creation_fee_paid),0) as creation from tokens`;
  const [f] = await sql`select coalesce(sum(quote_protocol),0) as proto from fee_events`;
  const [platformToken, bal, nextAt, lastAt, pending, reserve, totalBoughtBack, totalBurned, totalToEco, ecoFund, feeRecipient, nextBuyAt, nextSlice, devFund, totalToDev] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "platformToken" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "usdcBalance" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "nextExecuteAt" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "lastExecutedAt" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "pendingRevenue" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "buybackReserve" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "totalBoughtBack" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "totalBurned" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "totalToEco" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "ecoFund" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "feeRecipient" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "nextBuybackAt" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "nextBuybackAmount" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "devFund" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "totalToDev" },
    ],
  });
  const burns = await sql`select tx_hash, ts, usdc_spent, tokens_burned, usdc_to_eco, usdc_to_dev from burns order by ts desc limit 100`;
  const configured = platformToken !== "0x0000000000000000000000000000000000000000";
  const [pt] = configured ? await sql`select * from tokens where address = ${getAddress(platformToken)}` : [null];
  return c.json({
    address: ADDR.treasury,
    usdcBalance: bal.toString(),
    fromCreationFees: s.creation,
    fromTradeFees: f.proto,
    // immutable split of the protocol share (25% of the 1% pool fee): 76% eco reserve / 20% buyback & burn / 4% dev
    // → of the whole 1% fee: 75 creator / 19 reserve / 5 buyback / 1 dev
    buybackBps: 2000,
    ecoBps: 7600,
    devBps: 400,
    intervalSec: 7 * 86400,
    lastExecutedAt: Number(lastAt),
    nextExecuteAt: Number(nextAt),
    pendingRevenueUsdc: pending.toString(),
    buybackReserveUsdc: reserve.toString(),
    // the reserve is spent in impact-capped slices (≤1.5% price move each), one per cooldown
    buybackCooldownSec: 600,
    nextBuybackAt: Number(nextBuyAt),
    nextBuybackAmountUsdc: nextSlice.toString(),
    feeRecipient,
    ecoFund,
    devFund,
    totalBoughtBackUsdc: totalBoughtBack.toString(),
    totalBurned: totalBurned.toString(),
    totalToEcoUsdc: totalToEco.toString(),
    totalToDevUsdc: totalToDev.toString(),
    platformToken: configured ? shapeToken(pt as Record<string, unknown>) : null,
    burns: burns.map((b) => ({ hash: b.tx_hash, time: b.ts, usdcSpent: b.usdc_spent, tokensBurned: b.tokens_burned, usdcToEco: b.usdc_to_eco, usdcToDev: b.usdc_to_dev })),
  });
});

app.get("/api/wallet/:address", async (c) => {
  const a = addr(c.req.param("address"));
  const holdings = await sql`select h.balance, t.* from holders h join tokens t on t.address = h.token where h.address = ${a} and h.balance > 0 order by h.balance desc`;
  const trades = await sql`select tr.ts, tr.side, tr.usdc, tr.tokens, tr.price, tr.tx_hash, t.address as token, t.symbol, t.logo from trades tr join tokens t on t.address = tr.token
    where tr.recipient = ${a} order by tr.ts desc limit 100`;
  const usdc = await client.readContract({ address: ADDR.usdc, abi: erc20Abi, functionName: "balanceOf", args: [a] }).catch(() => 0n);
  return c.json({
    address: a,
    usdcBalance: usdc.toString(),
    holdings: holdings.map((h) => ({ balance: h.balance, valueUsd: (Number(h.balance) / 1e18) * Number(h.last_price), token: shapeToken(h) })),
    trades: trades.map((r) => ({ time: r.ts, side: r.side, usdc: r.usdc, tokens: r.tokens, price: r.price, hash: r.tx_hash, token: r.token, symbol: r.symbol, logo: r.logo })),
  });
});

// ---------------------------------------------------------------- logo upload

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_UPLOAD = 1024 * 1024; // 1 MB
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? "https://arclaunch.top";

function sniffImage(buf: Uint8Array): string | null {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "webp";
  return null;
}

app.post("/api/upload", async (c) => {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  if (file.size > MAX_UPLOAD) return c.json({ error: "max 1 MB" }, 413);
  const buf = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) return c.json({ error: "png/jpg/gif/webp only" }, 415);
  const name = `${createHash("sha256").update(buf).digest("hex").slice(0, 32)}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(`${UPLOAD_DIR}/${name}`, buf);
  return c.json({ url: `${PUBLIC_BASE}/api/uploads/${name}`, name, size: buf.length });
});

app.get("/api/uploads/:name", async (c) => {
  const { readFile } = await import("node:fs/promises");
  const name = c.req.param("name");
  if (!/^[a-f0-9]{32}\.(png|jpg|gif|webp)$/.test(name)) return c.json({ error: "not found" }, 404);
  try {
    const data = await readFile(`${UPLOAD_DIR}/${name}`);
    const type = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[name.split(".")[1]]!;
    return new Response(data, { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

// ---------------------------------------------------------------- comments (off-chain, wallet-signed)

export const commentMessage = (token: string, text: string, ts: number, replyTo?: number | null) =>
  `ArcLaunch comment\ntoken: ${token.toLowerCase()}\nreplyTo: ${replyTo ?? "-"}\nts: ${ts}\n\n${text}`;
export const likeMessage = (commentId: number, ts: number) => `ArcLaunch like\ncomment: ${commentId}\nts: ${ts}`;

async function verifySig(author: string, message: string, signature: string) {
  const { verifyMessage } = await import("viem");
  return verifyMessage({ address: getAddress(author), message, signature: signature as `0x${string}` });
}

app.get("/api/tokens/:address/comments", async (c) => {
  const a = addr(c.req.param("address"));
  const viewer = c.req.query("viewer");
  const [t] = await sql`select deployer, payout from tokens where address = ${a}`;
  if (!t) return c.json({ error: "not found" }, 404);
  const rows = await sql`
    select cm.id, cm.author, cm.text, cm.reply_to, cm.ts,
           (select count(*) from comment_likes l where l.comment_id = cm.id) as likes,
           ${viewer && isAddress(viewer) ? sql`exists(select 1 from comment_likes l where l.comment_id = cm.id and l.author = ${getAddress(viewer)})` : sql`false`} as liked
    from comments cm where cm.token = ${a} order by cm.ts asc limit 500`;
  return c.json(rows.map((r) => ({
    id: Number(r.id), author: r.author, text: r.text, replyTo: r.reply_to ? Number(r.reply_to) : null, time: r.ts,
    likes: Number(r.likes), liked: !!r.liked,
    isCreator: r.author.toLowerCase() === t.deployer.toLowerCase() || r.author.toLowerCase() === t.payout.toLowerCase(),
  })));
});

app.post("/api/tokens/:address/comments", async (c) => {
  const a = addr(c.req.param("address"));
  const body = await c.req.json<{ author: string; text: string; replyTo?: number | null; ts: number; signature: string }>();
  const text = (body.text ?? "").trim();
  if (!text || text.length > 280) return c.json({ error: "text 1–280 chars" }, 400);
  if (!isAddress(body.author)) return c.json({ error: "bad author" }, 400);
  if (Math.abs(Date.now() - body.ts) > 5 * 60_000) return c.json({ error: "stale timestamp" }, 400);
  const [t] = await sql`select 1 from tokens where address = ${a}`;
  if (!t) return c.json({ error: "not found" }, 404);
  if (body.replyTo) {
    const [p] = await sql`select 1 from comments where id = ${body.replyTo} and token = ${a}`;
    if (!p) return c.json({ error: "bad replyTo" }, 400);
  }
  const ok = await verifySig(body.author, commentMessage(a, text, body.ts, body.replyTo ?? null), body.signature).catch(() => false);
  if (!ok) return c.json({ error: "bad signature" }, 401);
  const author = getAddress(body.author);
  const [recent] = await sql`select ts from comments where author = ${author} order by ts desc limit 1`;
  if (recent && Date.now() - new Date(recent.ts).getTime() < 10_000) return c.json({ error: "slow down" }, 429);
  const [row] = await sql`insert into comments (token, author, text, reply_to, signature) values (${a}, ${author}, ${text}, ${body.replyTo ?? null}, ${body.signature}) returning id, ts`;
  return c.json({ id: Number(row.id), time: row.ts });
});

app.post("/api/comments/:id/like", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ author: string; ts: number; signature: string }>();
  if (!isAddress(body.author) || !Number.isFinite(id)) return c.json({ error: "bad request" }, 400);
  if (Math.abs(Date.now() - body.ts) > 5 * 60_000) return c.json({ error: "stale timestamp" }, 400);
  const ok = await verifySig(body.author, likeMessage(id, body.ts), body.signature).catch(() => false);
  if (!ok) return c.json({ error: "bad signature" }, 401);
  const author = getAddress(body.author);
  const [existing] = await sql`select 1 from comment_likes where comment_id = ${id} and author = ${author}`;
  if (existing) await sql`delete from comment_likes where comment_id = ${id} and author = ${author}`;
  else await sql`insert into comment_likes (comment_id, author) values (${id}, ${author})`;
  const [{ n }] = await sql`select count(*) as n from comment_likes where comment_id = ${id}`;
  return c.json({ liked: !existing, likes: Number(n) });
});

// ---------------------------------------------------------------- community takeover (CTO) requests
// Off-chain application signed by the requester. Review happens in /admin; approval there is just the owner
// filing the on-chain proposePayout() (48h timelock, creator can veto), so this table never moves funds.

export const ctoMessage = (token: string, newPayout: string, contact: string, reason: string, ts: number) =>
  `ArcLaunch CTO request\ntoken: ${token.toLowerCase()}\nnewPayout: ${newPayout.toLowerCase()}\ncontact: ${contact}\nts: ${ts}\n\n${reason}`;
export const ctoReviewMessage = (id: number, status: string, ts: number) => `ArcLaunch CTO review\nrequest: ${id}\nstatus: ${status}\nts: ${ts}`;

const shapeCto = (r: Record<string, unknown>) => ({
  id: Number(r.id), token: r.token, symbol: r.symbol, logo: r.logo, payout: r.payout,
  requester: r.requester, newPayout: r.new_payout, contact: r.contact, reason: r.reason, status: r.status, time: r.ts,
});

app.post("/api/cto", async (c) => {
  const body = await c.req.json<{ token: string; requester: string; newPayout: string; contact?: string; reason: string; ts: number; signature: string }>();
  if (!isAddress(body.token) || !isAddress(body.requester) || !isAddress(body.newPayout)) return c.json({ error: "bad address" }, 400);
  const reason = (body.reason ?? "").trim();
  const contact = (body.contact ?? "").trim();
  if (reason.length < 20 || reason.length > 1000) return c.json({ error: "reason 20–1000 chars" }, 400);
  if (contact.length > 120) return c.json({ error: "contact too long" }, 400);
  if (Math.abs(Date.now() - body.ts) > 5 * 60_000) return c.json({ error: "stale timestamp" }, 400);
  const token = getAddress(body.token);
  const [t] = await sql`select payout from tokens where address = ${token}`;
  if (!t) return c.json({ error: "not found" }, 404);
  const ok = await verifySig(body.requester, ctoMessage(token, body.newPayout, contact, reason, body.ts), body.signature).catch(() => false);
  if (!ok) return c.json({ error: "bad signature" }, 401);
  const requester = getAddress(body.requester);
  const [dup] = await sql`select 1 from cto_requests where token = ${token} and requester = ${requester} and status = 'open'`;
  if (dup) return c.json({ error: "you already have an open request for this token" }, 409);
  const [recent] = await sql`select ts from cto_requests where requester = ${requester} order by ts desc limit 1`;
  if (recent && Date.now() - new Date(recent.ts).getTime() < 60_000) return c.json({ error: "slow down" }, 429);
  const [row] = await sql`insert into cto_requests (token, requester, new_payout, contact, reason, signature)
    values (${token}, ${requester}, ${getAddress(body.newPayout)}, ${contact}, ${reason}, ${body.signature}) returning id, ts`;
  return c.json({ id: Number(row.id), time: row.ts });
});

/** Public: open request count per token (shown on the token page so the community knows a takeover is being asked for). */
app.get("/api/tokens/:address/cto", async (c) => {
  const a = addr(c.req.param("address"));
  const rows = await sql`select r.*, t.symbol, t.logo, t.payout from cto_requests r join tokens t on t.address = r.token where r.token = ${a} order by r.ts desc limit 20`;
  return c.json(rows.map(shapeCto));
});

app.get("/api/admin/cto", async (c) => {
  const rows = await sql`select r.*, t.symbol, t.logo, t.payout from cto_requests r join tokens t on t.address = r.token order by (r.status = 'open') desc, r.ts desc limit 200`;
  return c.json(rows.map(shapeCto));
});

/** Owner-only status change, authenticated by an EIP-191 signature from the on-chain factory owner. */
app.post("/api/admin/cto/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ author: string; status: string; ts: number; signature: string }>();
  if (!Number.isFinite(id) || !isAddress(body.author) || !["approved", "rejected", "open"].includes(body.status)) return c.json({ error: "bad request" }, 400);
  if (Math.abs(Date.now() - body.ts) > 5 * 60_000) return c.json({ error: "stale timestamp" }, 400);
  const owner = await client.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: "owner" });
  if (owner.toLowerCase() !== body.author.toLowerCase()) return c.json({ error: "not owner" }, 403);
  const ok = await verifySig(body.author, ctoReviewMessage(id, body.status, body.ts), body.signature).catch(() => false);
  if (!ok) return c.json({ error: "bad signature" }, 401);
  await sql`update cto_requests set status = ${body.status} where id = ${id}`;
  return c.json({ id, status: body.status });
});

// ------------------------------------------------------------------ admin panel
// Everything here is derived from public chain data / the public index; the panel itself is gated in the
// frontend by the on-chain owner() and every action is a wallet-signed tx, so there is no server secret.

app.get("/api/admin/overview", async (c) => {
  const [totals] = await sql`select
      (select count(*) from tokens) as tokens,
      (select count(*) from tokens where graduated) as graduated,
      (select count(*) from tokens where launch_ts > now() - interval '24 hours') as launched_24h,
      (select coalesce(sum(usdc),0) from trades) as volume_total,
      (select coalesce(sum(usdc),0) from trades where ts > now() - interval '24 hours') as volume_24h,
      (select count(*) from trades) as trades_total,
      (select count(distinct sender) from trades) as traders,
      (select count(distinct address) from holders where balance > 0) as holders,
      (select coalesce(sum(quote_creator + quote_protocol),0) from fee_events) as fees_total,
      (select coalesce(sum(quote_creator),0) from fee_events) as fees_creator,
      (select coalesce(sum(quote_protocol),0) from fee_events) as fees_protocol,
      (select coalesce(sum(usdc_from_token),0) from fee_events) as fees_from_token,
      (select count(*) from fee_events where not creator_paid) as payouts_parked,
      (select coalesce(sum(creation_fee_paid),0) from tokens) as creation_fees,
      (select coalesce(sum(usdc_spent),0) from burns) as buyback_usdc,
      (select coalesce(sum(tokens_burned),0) from burns) as burned,
      (select coalesce(sum(usdc_to_eco),0) from burns) as to_eco,
      (select count(*) from comments) as comments`;

  const daily = await sql`with days as (select generate_series((now() - interval '29 days')::date, now()::date, '1 day')::date as d)
    select d,
      (select count(*) from tokens where launch_ts::date = d) as launches,
      (select coalesce(sum(usdc),0) from trades where ts::date = d) as volume,
      (select count(*) from trades where ts::date = d) as trades,
      (select coalesce(sum(quote_creator + quote_protocol),0) from fee_events where ts::date = d) as fees,
      (select coalesce(sum(creation_fee_paid),0) from tokens where launch_ts::date = d) as creation_fees
    from days order by d`;

  const toks = await sql`select t.*, coalesce(v.volume_24h,0) as volume_24h, coalesce(h.holders,0) as holders from tokens t
    left join (select token, sum(usdc) as volume_24h from trades where ts > now() - interval '24 hours' group by token) v on v.token = t.address
    left join (select token, count(*) as holders from holders where balance > 0 group by token) h on h.token = t.address
    order by t.launch_ts desc limit 500`;

  // on-chain state per token: unconverted fee backlog, pending takeover proposal, parked creator payout
  const calls = toks.flatMap((t) => [
    { address: ADDR.locker, abi: lockerAbi, functionName: "unconvertedTokenFees" as const, args: [t.address as Address] },
    { address: ADDR.locker, abi: lockerAbi, functionName: "pendingPayout" as const, args: [t.address as Address] },
    { address: ADDR.locker, abi: lockerAbi, functionName: "claimable" as const, args: [t.payout as Address, ADDR.usdc] },
  ]);
  const chain = calls.length ? await client.multicall({ allowFailure: true, contracts: calls }) : [];
  const tokens = toks.map((t, i) => {
    const un = chain[i * 3]?.result as bigint | undefined;
    const pp = chain[i * 3 + 1]?.result as readonly [Address, bigint] | undefined;
    const cl = chain[i * 3 + 2]?.result as bigint | undefined;
    return {
      ...shapeToken(t, { volume24hUsdc: t.volume_24h, holders: Number(t.holders) }),
      volumeSinceDistribute: t.volume_since_distribute,
      creationFeePaid: t.creation_fee_paid,
      initialBuyUsdc: t.initial_buy_usdc,
      unconvertedTokenFees: (un ?? 0n).toString(),
      pendingPayout: pp && pp[0] !== ZERO ? { newPayout: pp[0], eta: Number(pp[1]) } : null,
      claimableUsdc: (cl ?? 0n).toString(),
    };
  });

  const feeEvents = await sql`select f.ts, f.tx_hash, f.token, t.symbol, f.quote_creator, f.quote_protocol, f.token_converted, f.usdc_from_token, f.creator_paid, f.payout, f.kind
    from fee_events f join tokens t on t.address = f.token order by f.ts desc limit 100`;

  const [fOwner, lOwner, tOwner, lTreasury, fee, thr, prot, maxHold, maxBuy, startMcap, ptoken, ecoFund, nextAt, reserve, tBal, maxTax, feeRcpt, pending] = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: ADDR.factory, abi: factoryAbi, functionName: "owner" },
      { address: ADDR.locker, abi: lockerAbi, functionName: "owner" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "owner" },
      { address: ADDR.locker, abi: lockerAbi, functionName: "treasury" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "creationFee" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "graduationThreshold" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "protectionBlocks" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "maxHoldBps" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "maxBuyBps" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "startMcapUsdc" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "platformToken" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "ecoFund" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "nextExecuteAt" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "buybackReserve" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "usdcBalance" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "maxTaxBps" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "feeRecipient" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "pendingRevenue" },
    ],
  });
  const r = <T,>(x: { result?: unknown }) => x.result as T | undefined;

  const [{ v: lastBlock }] = await sql`select value as v from sync_state where key = 'last_block'`.catch(() => [{ v: null }]);
  const head = await client.getBlockNumber().catch(() => null);
  let keeperAddress: string | null = null;
  let keeperBalance: string | null = null;
  if (config.keeper.enabled && config.keeper.privateKey) {
    try {
      const { account } = keeperWallet();
      keeperAddress = account.address;
      keeperBalance = (await client.getBalance({ address: account.address })).toString();
    } catch {}
  }

  return c.json({
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, String(v)])),
    daily: daily.map((d) => ({ day: d.d, launches: Number(d.launches), volume: String(d.volume), trades: Number(d.trades), fees: String(d.fees), creationFees: String(d.creation_fees) })),
    tokens,
    feeEvents: feeEvents.map((f) => ({ time: f.ts, hash: f.tx_hash, token: f.token, symbol: f.symbol, quoteCreator: f.quote_creator, quoteProtocol: f.quote_protocol, tokenConverted: f.token_converted, usdcFromToken: f.usdc_from_token, creatorPaid: f.creator_paid, payout: f.payout, kind: f.kind })),
    owners: { factory: r<string>(fOwner) ?? null, locker: r<string>(lOwner) ?? null, treasury: r<string>(tOwner) ?? null },
    params: {
      creationFee: (r<bigint>(fee) ?? 0n).toString(),
      graduationThreshold: (r<bigint>(thr) ?? 0n).toString(),
      protectionBlocks: Number(r<bigint>(prot) ?? 0n),
      maxHoldBps: Number(r<number>(maxHold) ?? 0),
      maxBuyBps: Number(r<number>(maxBuy) ?? 0),
      startMcapUsdc: (r<bigint>(startMcap) ?? 0n).toString(),
      maxTaxBps: Number(r<number>(maxTax) ?? 0),
      feeRecipient: r<string>(feeRcpt) ?? null,
      lockerTreasury: r<string>(lTreasury) ?? null,
      treasury: {
        platformToken: r<string>(ptoken) ?? ZERO,
        ecoFund: r<string>(ecoFund) ?? ZERO,
        nextExecuteAt: Number(r<bigint>(nextAt) ?? 0n),
        pendingRevenueUsdc: (r<bigint>(pending) ?? 0n).toString(),
        buybackReserveUsdc: (r<bigint>(reserve) ?? 0n).toString(),
        usdcBalance: (r<bigint>(tBal) ?? 0n).toString(),
      },
    },
    keeper: { enabled: config.keeper.enabled, address: keeperAddress, balance: keeperBalance, intervalMs: config.keeper.intervalMs, feeThresholdUsdc: config.keeper.feeThresholdUsdc.toString(), maxAgeMs: config.keeper.maxAgeMs, ...keeperState() },
    sync: { lastBlock: lastBlock ? Number(lastBlock) : null, head: head ? Number(head) : null, startBlock: Number(config.startBlock), rpc: config.rpcUrl.replace(/\/\/([^@]+)@/, "//***@") },
    addresses: deployments,
  });
});

app.onError((err, c) => {
  console.error("[api]", err.message);
  return c.json({ error: err.message }, 400);
});
