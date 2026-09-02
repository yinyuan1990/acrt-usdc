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
    token_creator numeric(78,0) not null,
    token_protocol numeric(78,0) not null,
    creator_paid boolean not null,
    payout text not null,
    unique (tx_hash, log_index)
  )`;
  await sql`create index if not exists fee_events_payout_ts on fee_events (payout, ts desc)`;

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
