import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAddress, isAddress, type Address } from "viem";
import { sql } from "./db.js";
import { client, ADDR } from "./chain.js";
import { deployments, config } from "./config.js";
import { factoryAbi, lockerAbi, erc20Abi } from "./abi.js";
import { sqrtPriceX96ForMcap } from "./price.js";

export const app = new Hono();
app.use("*", cors());

const INTERVALS: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
const SUPPLY_TOKENS = 1_000_000_000;

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
    socials: { website: r.website, twitter: r.twitter, telegram: r.telegram },
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
    ...extra,
  };
}

app.get("/api/health", async (c) => {
  const [{ v }] = await sql`select value as v from sync_state where key = 'last_block'`.catch(() => [{ v: null }]);
  const head = await client.getBlockNumber().catch(() => null);
  return c.json({ ok: true, lastBlock: v ? Number(v) : null, head: head ? Number(head) : null, chainId: deployments.chainId });
});

app.get("/api/config", async (c) => {
  const [fee, feeOn, thr, prot, maxHold, maxBuy, total] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: ADDR.factory, abi: factoryAbi, functionName: "creationFee" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "creationFeeEnabled" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "graduationThreshold" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "protectionBlocks" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "maxHoldBps" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "maxBuyBps" },
      { address: ADDR.factory, abi: factoryAbi, functionName: "totalLaunches" },
    ],
  });
  return c.json({
    chainId: deployments.chainId,
    addresses: deployments,
    params: {
      creationFee: fee.toString(),
      creationFeeEnabled: feeOn,
      graduationThreshold: thr.toString(),
      protectionBlocks: Number(prot),
      maxHoldBps: maxHold,
      maxBuyBps: maxBuy,
      creatorShareBps: 7500,
      poolFee: 10000,
      totalLaunches: Number(total),
    },
  });
});

/** Helper for the create form: predicted orientation + sqrtPrice for a target mcap, and the caller's fee. */
app.get("/api/launch-quote", async (c) => {
  const mcapUsd = Number(c.req.query("mcapUsd") ?? "5000");
  const account = c.req.query("account");
  const nonce = await client.getTransactionCount({ address: ADDR.factory });
  const { getContractAddress } = await import("viem");
  const predicted = getContractAddress({ from: ADDR.factory, nonce: BigInt(nonce) });
  const isToken0 = predicted.toLowerCase() < ADDR.usdc.toLowerCase();
  const mcap6 = BigInt(Math.round(mcapUsd * 1e6));
  const fee = account && isAddress(account) ? await client.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: "quoteCreationFee", args: [getAddress(account)] }) : null;
  return c.json({ predictedToken: predicted, isToken0, sqrtPriceX96: sqrtPriceX96ForMcap(mcap6, isToken0).toString(), creationFee: fee?.toString() ?? null });
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

app.get("/api/tokens", async (c) => {
  const sort = c.req.query("sort") ?? "volume";
  const filter = c.req.query("filter") ?? "all";
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const where = filter === "graduated" ? sql`where t.graduated` : filter === "graduating" ? sql`where not t.graduated` : sql``;
  const order =
    sort === "new" ? sql`t.launch_ts desc`
    : sort === "mcap" ? sql`t.last_mcap6 desc`
    : sort === "progress" ? sql`(t.paired_usdc::numeric / nullif(t.graduation_threshold,0)) desc nulls last, t.launch_ts desc`
    : sql`v.volume_24h desc nulls last, t.launch_ts desc`;
  const rows = await sql`
    select t.*, coalesce(v.volume_24h,0) as volume_24h, coalesce(v.trades_24h,0) as trades_24h, coalesce(h.holders,0) as holders,
           p.price_24h_ago
    from tokens t
    left join (select token, sum(usdc) as volume_24h, count(*) as trades_24h from trades where ts > now() - interval '24 hours' group by token) v on v.token = t.address
    left join (select token, count(*) as holders from holders where balance > 0 group by token) h on h.token = t.address
    left join lateral (select price as price_24h_ago from trades where token = t.address and ts <= now() - interval '24 hours' order by ts desc limit 1) p on true
    ${where}
    order by ${order}
    limit ${limit}`;
  return c.json(rows.map((r) => shapeToken(r, {
    volume24hUsdc: r.volume_24h,
    trades24h: Number(r.trades_24h),
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
  const poolUsdc = await client.readContract({ address: ADDR.usdc, abi: erc20Abi, functionName: "balanceOf", args: [t.pool as Address] }).catch(() => null);
  const head = await client.getBlockNumber();
  return c.json(shapeToken(t, {
    volume24hUsdc: t.volume_24h,
    trades24h: Number(t.trades_24h),
    holders: Number(t.holders),
    change24h: t.price_24h_ago ? ((Number(t.last_price) - Number(t.price_24h_ago)) / Number(t.price_24h_ago)) * 100 : null,
    poolUsdc: poolUsdc?.toString() ?? t.paired_usdc,
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
      : r.address.toLowerCase() === ADDR.treasury.toLowerCase() ? "Treasury" : undefined;
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
  const toks = await sql`select t.*, coalesce(v.volume_24h,0) as volume_24h from tokens t
    left join (select token, sum(usdc) as volume_24h from trades where ts > now() - interval '24 hours' group by token) v on v.token = t.address
    where t.deployer = ${a} or t.payout = ${a} order by t.launch_ts desc`;
  const payouts = await sql`select f.ts, f.tx_hash, f.quote_creator, f.token_creator, f.creator_paid, f.token, t.symbol, t.logo
    from fee_events f join tokens t on t.address = f.token where f.payout = ${a} order by f.ts desc limit 100`;
  const claimable = await client.readContract({ address: ADDR.locker, abi: lockerAbi, functionName: "claimable", args: [a, ADDR.usdc] }).catch(() => 0n);
  const [sums] = await sql`select coalesce(sum(quote_creator),0) as earned from fee_events where payout = ${a} and creator_paid`;
  const [pend] = await sql`select coalesce(sum(volume_since_distribute),0) as vol from tokens where payout = ${a}`;
  return c.json({
    address: a,
    tokens: toks.map((r) => shapeToken(r, { volume24hUsdc: r.volume_24h })),
    payouts: payouts.map((p) => ({ time: p.ts, hash: p.tx_hash, usdc: p.quote_creator, tokens: p.token_creator, paid: p.creator_paid, token: p.token, symbol: p.symbol, logo: p.logo })),
    earnedUsdc: sums.earned,
    pendingEstimateUsdc: ((BigInt(pend.vol) * 75n) / 10_000n).toString(), // 1% fee × 75%
    claimableUsdc: claimable.toString(),
  });
});

app.get("/api/treasury", async (c) => {
  const [s] = await sql`select coalesce(sum(creation_fee_paid),0) as creation from tokens`;
  const [f] = await sql`select coalesce(sum(quote_protocol),0) as proto from fee_events`;
  const bal = await client.readContract({ address: ADDR.usdc, abi: erc20Abi, functionName: "balanceOf", args: [ADDR.treasury] }).catch(() => 0n);
  return c.json({ address: ADDR.treasury, usdcBalance: bal.toString(), fromCreationFees: s.creation, fromTradeFees: f.proto, buybackBps: 8200, ecoBps: 1800, burns: [] });
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

app.onError((err, c) => {
  console.error("[api]", err.message);
  return c.json({ error: err.message }, 400);
});
