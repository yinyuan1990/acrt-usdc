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
  socials: { website: string; twitter: string; telegram: string; discord: string; farcaster: string };
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
  /** tax mode: creator-set at launch, immutable. 0/0 = standard token */
  buyTaxBps: number;
  sellTaxBps: number;
  taxMarketingWallet: string;
  taxTeamWallet: string;
  /** share of the tax to the marketing wallet; the rest goes to the team wallet */
  taxMarketingBps: number;
  taxUsdcTotal: string;
  // list/detail extras
  volume24hUsdc?: string;
  trades24h?: number;
  /** volume over the requested `window` (list endpoint only) */
  volumeUsdc?: string;
  tradesWindow?: number;
  holders?: number;
  change24h?: number | null;
  poolUsdc?: string;
  poolTokens?: string;
  liquidityUsd?: number;
  burnedTokens?: string;
  fdvUsd?: number;
  circulatingMcapUsd?: number;
  protectionActive?: boolean;
  currentBlock?: number;
  /** creator endpoint: live takeover proposal against this token */
  pendingPayout?: { newPayout: string; eta: number } | null;
};

export type Health = { ok: boolean; lastBlock: number | null; head: number | null; chainId: number };
export type CtoRequest = {
  id: number; token: string; symbol: string; logo: string; payout: string;
  requester: string; newPayout: string; contact: string; reason: string; status: "open" | "approved" | "rejected"; time: string;
};
export type TokenWindow = "24h" | "7d" | "all";
export type Analytics = {
  latestDay: string;
  day: { volumeUsdc: string; trades: number; traders: number; launches: number; feesUsdc: string };
  allTime: { volumeUsdc: string; trades: number; traders: number; launches: number; graduated: number; feesUsdc: string; feesCreatorUsdc: string; creationFeesUsdc: string; buybackUsdc: string; burned: string };
  daily: { day: string; launches: number; volumeUsdc: string; trades: number; feesUsdc: string }[];
  source: { factory: string; locker: string; treasury: string; chainId: number };
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
  payouts: { time: string; hash: string; usdc: string; usdcFromToken: string; paid: boolean; kind: "fee" | "tax_marketing" | "tax_team"; token: string; symbol: string; logo: string }[];
  earnedUsdc: string; pendingEstimateUsdc: string; claimableUsdc: string;
};
export type WalletView = {
  address: string; usdcBalance: string;
  holdings: { balance: string; valueUsd: number; token: TokenView }[];
  trades: { time: string; side: "buy" | "sell"; usdc: string; tokens: string; price: number; hash: string; token: string; symbol: string; logo: string }[];
};
export type Burn = { hash: string; time: string; usdcSpent: string; tokensBurned: string; usdcToEco: string };
export type TreasuryView = {
  address: string; usdcBalance: string; fromCreationFees: string; fromTradeFees: string; buybackBps: number; ecoBps: number; devBps: number; devFund: string; totalToDevUsdc: string;
  intervalSec: number; lastExecutedAt: number; nextExecuteAt: number; pendingRevenueUsdc: string; buybackReserveUsdc: string; feeRecipient: string; ecoFund: string;
  buybackCooldownSec: number; nextBuybackAt: number; nextBuybackAmountUsdc: string;
  totalBoughtBackUsdc: string; totalBurned: string; totalToEcoUsdc: string;
  platformToken: TokenView | null; burns: Burn[];
};
export type Comment = { id: number; author: string; text: string; replyTo: number | null; time: string; likes: number; liked: boolean; isCreator: boolean };
export type ConfigView = {
  chainId: number;
  addresses: Record<string, string | number>;
  params: { creationFee: string; graduationThreshold: string; protectionBlocks: number; maxHoldBps: number; maxBuyBps: number; startMcapUsdc: string; creatorShareBps: number; poolFee: number; totalLaunches: number; maxTaxBps: number };
};

/** Tax helpers (bps → fraction). Buys: pool output is taxed, buyer receives output × (1 − buy). Sells: tax is
 *  charged on top, so selling N costs N × (1 + sell) and the max sellable is balance / (1 + sell). */
export const isTaxToken = (t: Pick<TokenView, "buyTaxBps" | "sellTaxBps">) => (t.buyTaxBps ?? 0) > 0 || (t.sellTaxBps ?? 0) > 0;
export const afterBuyTax = (out: bigint, buyTaxBps: number) => out - (out * BigInt(buyTaxBps)) / 10_000n;
export const sellTaxOn = (amount: bigint, sellTaxBps: number) => (amount * BigInt(sellTaxBps)) / 10_000n;
export const maxSellable = (balance: bigint, sellTaxBps: number) => (balance * 10_000n) / (10_000n + BigInt(sellTaxBps));
export type LaunchQuote = { startMcapUsdc: string; creationFee: string };

export type AdminToken = TokenView & {
  volume24hUsdc: string; holders: number;
  volumeSinceDistribute: string; creationFeePaid: string; initialBuyUsdc: string;
  unconvertedTokenFees: string; pendingPayout: { newPayout: string; eta: number } | null; claimableUsdc: string;
};
export type AdminOverview = {
  totals: Record<"tokens" | "graduated" | "launched_24h" | "volume_total" | "volume_24h" | "trades_total" | "traders" | "holders" | "fees_total" | "fees_creator" | "fees_protocol" | "fees_from_token" | "payouts_parked" | "creation_fees" | "buyback_usdc" | "burned" | "to_eco" | "comments", string>;
  daily: { day: string; launches: number; volume: string; trades: number; fees: string; creationFees: string }[];
  tokens: AdminToken[];
  feeEvents: { time: string; hash: string; token: string; symbol: string; quoteCreator: string; quoteProtocol: string; tokenConverted: string; usdcFromToken: string; creatorPaid: boolean; payout: string; kind: "fee" | "tax_marketing" | "tax_team" }[];
  owners: { factory: string | null; locker: string | null; treasury: string | null };
  params: {
    creationFee: string; graduationThreshold: string; protectionBlocks: number; maxHoldBps: number; maxBuyBps: number; startMcapUsdc: string; maxTaxBps: number; feeRecipient: string | null; lockerTreasury: string | null;
    treasury: { platformToken: string; ecoFund: string; nextExecuteAt: number; pendingRevenueUsdc: string; buybackReserveUsdc: string; usdcBalance: string };
  };
  keeper: { enabled: boolean; address: string | null; balance: string | null; intervalMs: number; feeThresholdUsdc: string; maxAgeMs: number; lastTick: string | null; entries: { ts: string; action: string; token?: string; detail: string; hash?: string; ok: boolean }[] };
  sync: { lastBlock: number | null; head: number | null; startBlock: number; rpc: string };
  addresses: Record<string, string | number>;
};

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
export const useTokens = (sort: string, filter: string, window: TokenWindow = "24h") =>
  useQuery({ queryKey: ["tokens", sort, filter, window], queryFn: () => get<TokenView[]>(`/tokens?sort=${sort}&filter=${filter}&window=${window}&limit=100`), refetchInterval: 8_000 });
export const useAnalytics = () => useQuery({ queryKey: ["analytics"], queryFn: () => get<Analytics>("/analytics"), refetchInterval: 60_000 });
export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: () => get<Health>("/health"), refetchInterval: 15_000, retry: 1 });
export const useTokenCto = (address?: string) =>
  useQuery({ queryKey: ["cto", address], queryFn: () => get<CtoRequest[]>(`/tokens/${address}/cto`), enabled: !!address, staleTime: 30_000 });
export const useAdminCto = (enabled: boolean) =>
  useQuery({ queryKey: ["admin", "cto"], queryFn: () => get<CtoRequest[]>("/admin/cto"), enabled, refetchInterval: 30_000 });
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
export const useAdminOverview = (enabled: boolean) =>
  useQuery({ queryKey: ["admin", "overview"], queryFn: () => get<AdminOverview>("/admin/overview"), enabled, refetchInterval: 15_000 });
export const fetchLaunchQuote = (account?: string) =>
  get<LaunchQuote>(`/launch-quote${account ? `?account=${account}` : ""}`);
export const useComments = (address?: string, viewer?: string) =>
  useQuery({ queryKey: ["comments", address, viewer], queryFn: () => get<Comment[]>(`/tokens/${address}/comments${viewer ? `?viewer=${viewer}` : ""}`), enabled: !!address, refetchInterval: 8_000 });

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${res.status}`);
  return json as T;
}
export const postComment = (token: string, body: { author: string; text: string; replyTo: number | null; ts: number; signature: string }) =>
  post<{ id: number; time: string }>(`/tokens/${token}/comments`, body);
export const postLike = (id: number, body: { author: string; ts: number; signature: string }) => post<{ liked: boolean; likes: number }>(`/comments/${id}/like`, body);
export const postCto = (body: { token: string; requester: string; newPayout: string; contact: string; reason: string; ts: number; signature: string }) =>
  post<{ id: number; time: string }>("/cto", body);
export const postCtoStatus = (id: number, body: { author: string; status: CtoRequest["status"]; ts: number; signature: string }) =>
  post<{ id: number; status: string }>(`/admin/cto/${id}/status`, body);
export async function uploadLogo(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${res.status}`);
  return json as { url: string };
}

/** Must match indexer/src/api.ts */
export const commentMessage = (token: string, text: string, ts: number, replyTo?: number | null) =>
  `ArcLaunch comment\ntoken: ${token.toLowerCase()}\nreplyTo: ${replyTo ?? "-"}\nts: ${ts}\n\n${text}`;
export const likeMessage = (commentId: number, ts: number) => `ArcLaunch like\ncomment: ${commentId}\nts: ${ts}`;
export const ctoMessage = (token: string, newPayout: string, contact: string, reason: string, ts: number) =>
  `ArcLaunch CTO request\ntoken: ${token.toLowerCase()}\nnewPayout: ${newPayout.toLowerCase()}\ncontact: ${contact}\nts: ${ts}\n\n${reason}`;
export const ctoReviewMessage = (id: number, status: string, ts: number) => `ArcLaunch CTO review\nrequest: ${id}\nstatus: ${status}\nts: ${ts}`;

/** Progress toward graduation, 0–100. */
export const progressOf = (t: TokenView) => {
  const th = Number(t.graduationThreshold);
  if (!th) return 0;
  return Math.min(100, (Number(t.pairedUsdc) / th) * 100);
};
