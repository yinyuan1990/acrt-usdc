/**
 * Deterministic mock data so server and client render identically.
 * Will be replaced by the indexer API once contracts are on testnet.
 */

export const SUPPLY = 1_000_000_000;
export const GRADUATION_THRESHOLD = 10_000; // USDC paired principal
export const PLATFORM = {
  creationFee: 2, // USDC
  creationFeeEnabled: true,
  creatorShare: 75,
  protocolShare: 25,
  poolFee: 1,
  buybackShare: 82,
  ecoShare: 18,
  sweepThreshold: 50,
  sweepIntervalMin: 30,
};

export const BASE_NOW = Date.UTC(2026, 8, 2, 9, 30, 0);

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function addr(seed: number) {
  const r = rng(seed * 7919);
  let out = "0x";
  for (let i = 0; i < 40; i++) out += "0123456789abcdef"[Math.floor(r() * 16)];
  return out;
}

export type Token = {
  address: string;
  pool: string;
  name: string;
  symbol: string;
  emoji: string;
  hue: number;
  description: string;
  creator: string;
  createdAt: number;
  price: number;
  change24h: number;
  volume24h: number;
  holders: number;
  pairedUsdc: number;
  graduated: boolean;
  graduatedAt?: number;
  feesEarned: number;
  socials: { website?: string; twitter?: string; telegram?: string };
  protectionActive: boolean;
};

const seeds: Array<
  Pick<Token, "name" | "symbol" | "emoji" | "hue" | "description"> & {
    paired: number;
    change: number;
    ageMin: number;
    graduated?: boolean;
  }
> = [
  { name: "Arc Cat", symbol: "ACAT", emoji: "🐱", hue: 210, description: "The first cat on Arc. Pays gas in USDC, naps in dollars.", paired: 9420, change: 184.2, ageMin: 190 },
  { name: "Dollar Dog", symbol: "DDOG", emoji: "🐕", hue: 38, description: "Every bark is settled in under a second.", paired: 7210, change: 62.1, ageMin: 420 },
  { name: "Circle Frog", symbol: "CFROG", emoji: "🐸", hue: 140, description: "Ribbit. Deterministic finality. Ribbit.", paired: 13840, change: 31.5, ageMin: 1560, graduated: true },
  { name: "Stable Pepe", symbol: "SPEPE", emoji: "🧊", hue: 190, description: "Feels good man, especially when fees are $0.004.", paired: 2380, change: -12.4, ageMin: 55 },
  { name: "Gas Goblin", symbol: "GOB", emoji: "👺", hue: 0, description: "Hoards USDC gas. Refuses to pay in ETH.", paired: 5530, change: 9.8, ageMin: 830 },
  { name: "Mainnet Moon", symbol: "MOON", emoji: "🌕", hue: 265, description: "Launching 9.16. Not financial advice. Definitely a moon.", paired: 19870, change: 402.7, ageMin: 2900, graduated: true },
  { name: "Bridge Bear", symbol: "BBEAR", emoji: "🐻", hue: 25, description: "Crossed from Base via CCTP and never looked back.", paired: 640, change: -3.1, ageMin: 12 },
  { name: "Ledger Llama", symbol: "LLAMA", emoji: "🦙", hue: 320, description: "Spits on volatile gas tokens.", paired: 3110, change: 22.6, ageMin: 240 },
  { name: "Finality Fox", symbol: "FFOX", emoji: "🦊", hue: 20, description: "One confirmation. That's it. That's the fox.", paired: 8890, change: 57.3, ageMin: 610 },
  { name: "Treasury Turtle", symbol: "TRTL", emoji: "🐢", hue: 160, description: "Slow, steady, 82% buyback.", paired: 1250, change: 4.4, ageMin: 95 },
  { name: "Hook Hamster", symbol: "HOOK", emoji: "🐹", hue: 45, description: "Waiting for v4 hooks like everyone else.", paired: 410, change: -18.9, ageMin: 7 },
  { name: "Permit Penguin", symbol: "PNGN", emoji: "🐧", hue: 200, description: "Signs once, approves forever.", paired: 24600, change: 12.0, ageMin: 4300, graduated: true },
  { name: "Onchain Owl", symbol: "OWL", emoji: "🦉", hue: 280, description: "Watches every Transfer event so you don't have to.", paired: 6070, change: 38.8, ageMin: 330 },
  { name: "Yield Yak", symbol: "YAK", emoji: "🐃", hue: 90, description: "Not USYC. Just a yak.", paired: 180, change: 1.2, ageMin: 3 },
  { name: "Sub-second Sloth", symbol: "SLOTH", emoji: "🦥", hue: 110, description: "Ironically the fastest sloth in finance.", paired: 4460, change: -7.7, ageMin: 505 },
];

export const TOKENS: Token[] = seeds.map((s, i) => {
  const r = rng(i + 1);
  // rough single-sided v3 price model: price grows with paired usdc
  const price = (s.paired + 500) / SUPPLY * (1 + r() * 0.4);
  const graduated = !!s.graduated || s.paired >= GRADUATION_THRESHOLD;
  const createdAt = BASE_NOW - s.ageMin * 60_000;
  return {
    address: addr(i + 101),
    pool: addr(i + 501),
    name: s.name,
    symbol: s.symbol,
    emoji: s.emoji,
    hue: s.hue,
    description: s.description,
    creator: addr(i + 901),
    createdAt,
    price,
    change24h: s.change,
    volume24h: s.paired * (2.5 + r() * 6),
    holders: Math.floor(30 + s.paired / 25 + r() * 200),
    pairedUsdc: s.paired,
    graduated,
    graduatedAt: graduated ? createdAt + Math.floor(s.ageMin * 0.6) * 60_000 : undefined,
    feesEarned: s.paired * (2.5 + r() * 6) * 0.01 * (1 + s.ageMin / 1000),
    socials: {
      website: r() > 0.4 ? `https://${s.symbol.toLowerCase()}.arc` : undefined,
      twitter: `https://x.com/${s.symbol.toLowerCase()}onarc`,
      telegram: r() > 0.5 ? `https://t.me/${s.symbol.toLowerCase()}` : undefined,
    },
    protectionActive: s.ageMin < 1,
  };
});

export function getToken(address: string): Token | undefined {
  return TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase());
}

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export function candlesFor(token: Token, n = 120, stepSec = 60): Candle[] {
  const r = rng(token.address.length * 31 + token.hue);
  const out: Candle[] = [];
  let p = token.price / (1 + token.change24h / 100);
  const drift = Math.pow(1 + token.change24h / 100, 1 / n);
  const end = Math.floor(BASE_NOW / 1000 / stepSec) * stepSec;
  for (let i = 0; i < n; i++) {
    const open = p;
    const vol = 0.04 + r() * 0.06;
    const close = open * drift * (1 + (r() - 0.5) * vol);
    const high = Math.max(open, close) * (1 + r() * vol * 0.6);
    const low = Math.min(open, close) * (1 - r() * vol * 0.6);
    out.push({ time: end - (n - i) * stepSec, open, high, low, close, volume: (r() * 800 + 50) * (1 + i / n) });
    p = close;
  }
  return out;
}

export type Trade = { hash: string; time: number; side: "buy" | "sell"; usdc: number; tokens: number; price: number; wallet: string };

export function tradesFor(token: Token, n = 40): Trade[] {
  const r = rng(token.hue * 13 + 7);
  const out: Trade[] = [];
  let t = BASE_NOW;
  for (let i = 0; i < n; i++) {
    t -= Math.floor(r() * 90_000 + 5_000);
    const side: "buy" | "sell" = r() > 0.42 ? "buy" : "sell";
    const usdc = Math.round((r() ** 2 * 900 + 5) * 100) / 100;
    const price = token.price * (1 + (r() - 0.5) * 0.08);
    out.push({ hash: addr(i + 3000 + token.hue), time: t, side, usdc, tokens: usdc / price, price, wallet: addr(i + 7000 + token.hue) });
  }
  return out;
}

export type Holder = { wallet: string; pct: number; tokens: number; label?: string };

export function holdersFor(token: Token, n = 12): Holder[] {
  const r = rng(token.hue * 17 + 3);
  const poolPct = Math.max(35, 92 - token.pairedUsdc / 300);
  const out: Holder[] = [{ wallet: token.pool, pct: poolPct, tokens: (SUPPLY * poolPct) / 100, label: "Pool (locked)" }];
  let remaining = 100 - poolPct;
  for (let i = 0; i < n; i++) {
    const pct = Math.min(remaining * (0.12 + r() * 0.25), 4.99);
    remaining -= pct;
    out.push({ wallet: i === 0 ? token.creator : addr(i + 9000 + token.hue), pct, tokens: (SUPPLY * pct) / 100, label: i === 0 ? "Creator" : undefined });
  }
  return out;
}

export const PLATFORM_STATS = {
  launchedToday: 1_284,
  volumeToday: 2_418_930,
  feesToday: 24_189,
  totalBurnedUsd: 318_420,
  treasury: 41_930,
  totalRevenue: 612_480,
  fromCreation: 96_210,
  fromFees: 516_270,
  arclBurned: 12_640_000,
  arclSupply: 1_000_000_000,
  arclPrice: 0.0182,
  nextRunThreshold: 50_000,
};

export type BurnEvent = { hash: string; time: number; usdcSpent: number; arclBurned: number; avgPrice: number };

export const BURN_HISTORY: BurnEvent[] = Array.from({ length: 8 }, (_, i) => {
  const r = rng(i + 77);
  const usdc = 41_000 + Math.floor(r() * 12_000);
  const price = 0.012 + r() * 0.008;
  return { hash: addr(i + 12000), time: BASE_NOW - (i + 1) * 36 * 3600_000, usdcSpent: usdc, arclBurned: Math.floor(usdc / price), avgPrice: price };
});

export type Payout = { hash: string; time: number; token: Token; usdc: number; status: "paid" | "claimable" };

export const MY_ADDRESS = TOKENS[0].creator;
export const MY_TOKENS = [TOKENS[0], TOKENS[8], TOKENS[13]];

export const PAYOUTS: Payout[] = Array.from({ length: 14 }, (_, i) => {
  const r = rng(i + 555);
  const token = MY_TOKENS[i % MY_TOKENS.length];
  return { hash: addr(i + 15000), time: BASE_NOW - i * 31 * 60_000 - Math.floor(r() * 300_000), token, usdc: Math.round((50 + r() * 320) * 100) / 100, status: i === 2 ? "claimable" : "paid" };
});

export type Holding = { token: Token; tokens: number; avgCost: number };

export const HOLDINGS: Holding[] = [TOKENS[0], TOKENS[2], TOKENS[5], TOKENS[9]].map((t, i) => {
  const r = rng(i + 4242);
  return { token: t, tokens: Math.floor(1_000_000 + r() * 25_000_000), avgCost: t.price * (0.5 + r() * 0.9) };
});
