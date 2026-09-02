import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config, deployments } from "./config.js";

export const arc = defineChain({
  id: deployments.chainId,
  name: deployments.chainId === 5042002 ? "Arc Testnet" : "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  contracts: { multicall3: { address: config.multicall3 } },
  testnet: deployments.chainId === 5042002,
});

export const client = createPublicClient({
  chain: arc,
  transport: http(config.rpcUrl, { batch: true, retryCount: 3, timeout: 30_000 }),
});

export function keeperWallet() {
  if (!config.keeper.privateKey) throw new Error("KEEPER_PRIVATE_KEY not set");
  const account = privateKeyToAccount(config.keeper.privateKey);
  return {
    account,
    wallet: createWalletClient({ account, chain: arc, transport: http(config.rpcUrl) }),
  };
}

export const ADDR = {
  factory: deployments.launchFactory as Address,
  locker: deployments.feeLocker as Address,
  usdc: deployments.usdc as Address,
  treasury: deployments.treasury as Address,
  router: deployments.swapRouter as Address,
  quoter: deployments.quoterV2 as Address,
};
