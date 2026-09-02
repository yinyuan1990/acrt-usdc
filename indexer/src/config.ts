import { readFileSync } from "node:fs";
import type { Address } from "viem";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`missing env ${name}`);
  return v;
}

type Deployments = {
  chainId: number;
  deployBlock: number;
  usdc: Address;
  uniswapV3Factory: Address;
  positionManager: Address;
  swapRouter: Address;
  quoterV2: Address;
  treasury: Address;
  feeLocker: Address;
  launchFactory: Address;
};

const depPath = env("DEPLOYMENTS_FILE", "./deployments.json");
export const deployments: Deployments = JSON.parse(readFileSync(depPath, "utf8").replace(/^\uFEFF/, ""));

export const config = {
  rpcUrl: env("RPC_URL", "https://rpc.testnet.arc.io"),
  wsUrl: process.env.WS_URL, // optional
  databaseUrl: env("DATABASE_URL", "postgres://arclaunch:arclaunch@localhost:5432/arclaunch"),
  port: Number(env("PORT", "3101")),
  startBlock: BigInt(process.env.START_BLOCK ?? deployments.deployBlock),
  chunkSize: BigInt(process.env.CHUNK_SIZE ?? "2000"),
  pollMs: Number(process.env.POLL_MS ?? "1500"),
  refreshMs: Number(process.env.REFRESH_MS ?? "15000"),
  keeper: {
    enabled: (process.env.KEEPER_ENABLED ?? "false") === "true",
    privateKey: process.env.KEEPER_PRIVATE_KEY as `0x${string}` | undefined,
    intervalMs: Number(process.env.KEEPER_INTERVAL_MS ?? "60000"),
    // distribute when estimated accrued USDC fees >= this (6 decimals) ...
    feeThresholdUsdc: BigInt(process.env.KEEPER_FEE_THRESHOLD ?? "50000"), // 0.05 USDC on testnet
    // ... or when this much time passed since the last distribution and any volume happened
    maxAgeMs: Number(process.env.KEEPER_MAX_AGE_MS ?? String(30 * 60 * 1000)),
  },
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11" as Address,
  SUPPLY: 1_000_000_000n * 10n ** 18n,
};
