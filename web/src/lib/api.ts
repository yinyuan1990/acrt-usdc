"use client";

import { useQuery } from "@tanstack/react-query";

/** Base URL: same-origin `/api` in production (nginx → indexer); override for local dev. */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export type TokenView = {
  address: string;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: { website: string; twitter: string; telegram: string };
  deployer: string;
  payout: string;
  pool: string;
  positionId: string;
  isToken0: boolean;
  launchBlock: number;
  launchTs: string;
  launchTx: string;
  restrictionsEndBlock: number;
  graduationThreshold: string; // usdc 6dp
  pairedUsdc: string;
  graduated: boolean;
  graduatedAt: string | null;
  creatorShareBps: number;
  price: number; // usd per token
  mcapUsd: number;
  feesUsdcTotal: string;
  feesCreatorUsdcTotal: string;
  lastDistributedAt: string | null;
  // list/detail extras
  volume24hUsdc?: string;
  trades24h?: number;
  holders?: number;
  change24h?: number | null;
  poolUsdc?: string;
  protectionActive?: boolean;
  currentBlock?: number;
};

export type Trade = { hash: string; time: string; side: "buy" | "sell"; usdc: string; tokens: string; price: number; mcapUsd: number; wallet: string; block: number };
export type Holder = { wallet: string; balance: string; pct: number; label?: string };
export type Candle = { time: number; open: number; high: number; low: number; close: number; volumeUsdc: string; trades: number };
export type Activity = { kind: "buy" | "sell" | "launch"; ts: string; wallet: string; tx: string; token: string; symbol: string; logo: string; usdc?: string };
export type Stats = {
  tokens: number; launched24h: number; graduated: number;
  volume24hUsdc: string; volumeTotalUsdc: string; fees24hUsdc: string; feesTotalUsdc: string;
  creationFeesTotalUsdc: string; protocolFeesTotalUsdc: string; treasuryUsdc: string;
};
export type Creator = {
  address: string; tokens: TokenView[];
  payouts: { time: string; hash: string; usdc: string; tokens: string; paid: boolean; token: string; symbol: string; logo: string }[];
  earnedUsdc: string; pendingEstimateUsdc: string; claimableUsdc: string;
};
export type WalletView = {
  address: string; usdcBalance: string;
  holdings: { balance: string; valueUsd: number; token: TokenView }[];
  trades: { time: string; side: "buy" | "sell"; usdc: string; tokens: string; price: number; hash: string; token: string; symbol: string; logo: string }[];
};
export type TreasuryView = { address: string; usdcBalance: string; fromCreationFees: string; fromTradeFees: string; buybackBps: number; ecoBps: number; burns: unknown[] };
export type ConfigView = {
  chainId: number;
  addresses: Record<string, string | number>;
  params: { creationFee: string; creationFeeEnabled: boolean; graduationThreshold: string; protectionBlocks: number; maxHoldBps: number; maxBuyBps: number; creatorShareBps: number; poolFee: number; totalLaunches: number };
};
export type LaunchQuote = { predictedToken: string; isToken0: boolean; sqrtPriceX96: string; creationFee: string | null };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

/** USDC raw (6dp) string → number of dollars. */
export const usd = (raw?: string | null) => (raw ? Number(raw) / 1e6 : 0);
/** token raw (18dp) string → whole tokens. */
export const tok = (raw?: string | null) => (raw ? Number(raw) / 1e18 : 0);

export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: () => get<Stats>("/stats"), refetchInterval: 10_000 });
export const useConfig = () => useQuery({ queryKey: ["config"], queryFn: () => get<ConfigView>("/config"), staleTime: 60_000 });
export const useTokens = (sort: string, filter: string) =>
  useQuery({ queryKey: ["tokens", sort, filter], queryFn: () => get<TokenView[]>(`/tokens?sort=${sort}&filter=${filter}&limit=100`), refetchInterval: 8_000 });
// Right after a launch the indexer can lag the chain by a few seconds → keep retrying 404s for ~30s.
export const useToken = (address?: string) =>
  useQuery({ queryKey: ["token", address], queryFn: () => get<TokenView>(`/tokens/${address}`), enabled: !!address, refetchInterval: 5_000, retry: 15, retryDelay: 2_000 });
export const useCandles = (address?: string, interval = "1m") =>
  useQuery({ queryKey: ["candles", address, interval], queryFn: () => get<Candle[]>(`/tokens/${address}/candles?interval=${interval}&limit=500`), enabled: !!address, refetchInterval: 5_000 });
export const useTrades = (address?: string) =>
  useQuery({ queryKey: ["trades", address], queryFn: () => get<Trade[]>(`/tokens/${address}/trades?limit=80`), enabled: !!address, refetchInterval: 4_000 });
export const useHolders = (address?: string) =>
  useQuery({ queryKey: ["holders", address], queryFn: () => get<Holder[]>(`/tokens/${address}/holders?limit=50`), enabled: !!address, refetchInterval: 15_000 });
export const useActivity = () => useQuery({ queryKey: ["activity"], queryFn: () => get<Activity[]>("/activity?limit=40"), refetchInterval: 5_000 });
export const useCreator = (address?: string) =>
  useQuery({ queryKey: ["creator", address], queryFn: () => get<Creator>(`/creator/${address}`), enabled: !!address, refetchInterval: 10_000 });
export const useWallet = (address?: string) =>
  useQuery({ queryKey: ["wallet", address], queryFn: () => get<WalletView>(`/wallet/${address}`), enabled: !!address, refetchInterval: 10_000 });
export const useTreasury = () => useQuery({ queryKey: ["treasury"], queryFn: () => get<TreasuryView>("/treasury"), refetchInterval: 15_000 });
export const fetchLaunchQuote = (mcapUsd: number, account?: string) =>
  get<LaunchQuote>(`/launch-quote?mcapUsd=${mcapUsd}${account ? `&account=${account}` : ""}`);

/** Progress toward graduation, 0–100. */
export const progressOf = (t: TokenView) => {
  const th = Number(t.graduationThreshold);
  if (!th) return 0;
  return Math.min(100, (Number(t.pairedUsdc) / th) * 100);
};
