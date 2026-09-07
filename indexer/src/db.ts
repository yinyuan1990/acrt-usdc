import postgres from "postgres";
import { config } from "./config.js";

export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 30,
  transform: { undefined: null },
  types: {
    // keep numerics as strings; callers convert to BigInt/Number explicitly
    bigint: postgres.BigInt,
  },
});

export async function migrate() {
  await sql`create table if not exists sync_state (key text primary key, value text not null)`;

  await sql`create table if not exists tokens (
    address text primary key,
    name text not null,
    symbol text not null,
    logo text default '',
    description text default '',
    website text default '',
    twitter text default '',
    telegram text default '',
    discord text default '',
    farcaster text default '',
    deployer text not null,
    payout text not null,
    pool text not null,
    position_id numeric(78,0) not null,
    is_token0 boolean not null,
    launch_block bigint not null,
    launch_ts timestamptz not null,
    launch_tx text not null,
    restrictions_end_block bigint not null,
    graduation_threshold numeric(78,0) not null,
    initial_buy_usdc numeric(78,0) not null default 0,
    creation_fee_paid numeric(78,0) not null default 0,
    creator_share_bps int not null default 7500,
    graduated boolean not null default false,
    graduated_at timestamptz,
    paired_usdc numeric(78,0) not null default 0,
    last_price double precision not null default 0,
    last_mcap6 numeric(78,0) not null default 0,
    fees_usdc_total numeric(78,0) not null default 0,
    fees_creator_usdc_total numeric(78,0) not null default 0,
    last_distributed_at timestamptz,
    volume_since_distribute numeric(78,0) not null default 0,
    updated_at timestamptz not null default now()
  )`;

  await sql`alter table tokens add column if not exists discord text default ''`;
  await sql`alter table tokens add column if not exists farcaster text default ''`;
  // tax mode (creator-set, immutable): 0/0 = standard token
  await sql`alter table tokens add column if not exists buy_tax_bps int not null default 0`;
  await sql`alter table tokens add column if not exists sell_tax_bps int not null default 0`;
  await sql`alter table tokens add column if not exists tax_marketing_wallet text not null default ''`;
  await sql`alter table tokens add column if not exists tax_team_wallet text not null default ''`;
  await sql`alter table tokens add column if not exists tax_marketing_bps int not null default 0`;
  await sql`alter table tokens add column if not exists tax_usdc_total numeric(78,0) not null default 0`;
  await sql`alter table tokens drop column if exists tax_burn_bps`;
  await sql`alter table tokens drop column if exists tax_creator_usdc_total`;

  await sql`create table if not exists trades (
    id bigserial primary key,
    token text not null references tokens(address),
    pool text not null,
    tx_hash text not null,
    log_index int not null,
    block_number bigint not null,
    ts timestamptz not null,
    side text not null check (side in ('buy','sell')),
    usdc numeric(78,0) not null,
    tokens numeric(78,0) not null,
    price double precision not null,
    mcap6 numeric(78,0) not null,
    sender text not null,
    recipient text not null,
    unique (tx_hash, log_index)
  )`;
  await sql`create index if not exists trades_token_ts on trades (token, ts desc)`;
  await sql`create index if not exists trades_ts on trades (ts desc)`;

  await sql`create table if not exists candles (
    token text not null references tokens(address),
    bucket_ts timestamptz not null,
    open double precision not null,
    high double precision not null,
    low double precision not null,
    close double precision not null,
    volume_usdc numeric(78,0) not null default 0,
    trades int not null default 0,
    primary key (token, bucket_ts)
  )`;

  await sql`create table if not exists holders (
    token text not null references tokens(address),
    address text not null,
    balance numeric(78,0) not null,
    primary key (token, address)
  )`;
  await sql`create index if not exists holders_token_balance on holders (token, balance desc)`;

  await sql`create table if not exists fee_events (
    id bigserial primary key,
    token text not null references tokens(address),
    tx_hash text not null,
    log_index int not null,
    block_number bigint not null,
    ts timestamptz not null,
    quote_creator numeric(78,0) not null,
    quote_protocol numeric(78,0) not null,
    token_converted numeric(78,0) not null default 0,
    usdc_from_token numeric(78,0) not null default 0,
    creator_paid boolean not null,
    payout text not null,
    kind text not null default 'fee'
  )`;
  // FeeLocker v2: token-side fees are converted to USDC inside distribute; the old per-asset token split is gone.
  await sql`alter table fee_events add column if not exists token_converted numeric(78,0) not null default 0`;
  await sql`alter table fee_events add column if not exists usdc_from_token numeric(78,0) not null default 0`;
  await sql`alter table fee_events drop column if exists token_creator`;
  await sql`alter table fee_events drop column if exists token_protocol`;
  // 'fee' = 75/25 pool-fee split (payout = creator); 'tax_marketing' / 'tax_team' = tax proceeds to the two
  // tax wallets (payout = that wallet, quote_protocol = 0). One TaxDistributed log yields two rows, hence the
  // unique key includes kind.
  await sql`alter table fee_events add column if not exists kind text not null default 'fee'`;
  await sql`alter table fee_events drop constraint if exists fee_events_tx_hash_log_index_key`;
  await sql`create unique index if not exists fee_events_uq on fee_events (tx_hash, log_index, kind)`;
  await sql`create index if not exists fee_events_payout_ts on fee_events (payout, ts desc)`;

  await sql`create table if not exists burns (
    id bigserial primary key,
    tx_hash text not null unique,
    block_number bigint not null,
    ts timestamptz not null,
    usdc_spent numeric(78,0) not null,
    tokens_burned numeric(78,0) not null,
    usdc_to_eco numeric(78,0) not null
  )`;

  await sql`create table if not exists comments (
    id bigserial primary key,
    token text not null references tokens(address),
    author text not null,
    text text not null,
    reply_to bigint references comments(id),
    signature text not null,
    ts timestamptz not null default now()
  )`;
  await sql`create index if not exists comments_token_ts on comments (token, ts desc)`;

  await sql`create table if not exists comment_likes (
    comment_id bigint not null references comments(id),
    author text not null,
    primary key (comment_id, author)
  )`;

  // Community-takeover applications (off-chain, wallet-signed). The owner reviews them in /admin and, if
  // approved, files the on-chain proposePayout(); nothing here moves funds by itself.
  await sql`create table if not exists cto_requests (
    id bigserial primary key,
    token text not null references tokens(address),
    requester text not null,
    new_payout text not null,
    contact text not null default '',
    reason text not null,
    signature text not null,
    status text not null default 'open' check (status in ('open','approved','rejected')),
    ts timestamptz not null default now()
  )`;
  await sql`create index if not exists cto_requests_status_ts on cto_requests (status, ts desc)`;

  await sql`create table if not exists claims (
    id bigserial primary key,
    account text not null,
    asset text not null,
    amount numeric(78,0) not null,
    tx_hash text not null,
    ts timestamptz not null,
    unique (tx_hash, account, asset)
  )`;
}

export async function getSync(key: string): Promise<string | null> {
  const r = await sql`select value from sync_state where key = ${key}`;
  return r[0]?.value ?? null;
}

export async function setSync(key: string, value: string) {
  await sql`insert into sync_state (key, value) values (${key}, ${value})
            on conflict (key) do update set value = excluded.value`;
}
