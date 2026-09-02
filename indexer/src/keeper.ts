import type { Address } from "viem";
import { client, keeperWallet, ADDR } from "./chain.js";
import { config } from "./config.js";
import { sql } from "./db.js";
import { factoryAbi, lockerAbi, treasuryAbi, quoterAbi } from "./abi.js";

/**
 * Keeper: pushes creator/protocol fees on a schedule and persists graduation.
 * Decision uses indexed volume (Uniswap's tokensOwed is only refreshed on collect, so it can't be read ahead).
 */
export async function startKeeper() {
  const { account, wallet } = keeperWallet();
  console.log(`[keeper] enabled as ${account.address}, every ${config.keeper.intervalMs / 1000}s`);
  for (;;) {
    try {
      await tick(wallet, account.address);
    } catch (e) {
      console.error("[keeper] error:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, config.keeper.intervalMs));
  }
}

async function tick(wallet: ReturnType<typeof keeperWallet>["wallet"], _me: Address) {
  const rows = await sql<{ address: string; volume_since_distribute: string; last_distributed_at: Date | null; launch_ts: Date; graduated: boolean; paired_usdc: string; graduation_threshold: string }[]>`
    select address, volume_since_distribute, last_distributed_at, launch_ts, graduated, paired_usdc, graduation_threshold from tokens`;
  const now = Date.now();
  for (const t of rows) {
    const vol = BigInt(t.volume_since_distribute);
    const estFee = vol / 100n; // 1% pool fee
    const since = (t.last_distributed_at ?? t.launch_ts).getTime();
    const stale = now - since >= config.keeper.maxAgeMs;
    if (vol > 0n && (estFee >= config.keeper.feeThresholdUsdc || stale)) {
      // wallet client is bound to the local private-key account → signs locally, no eth_sendTransaction
      const hash = await wallet.writeContract({ address: ADDR.locker, abi: lockerAbi, functionName: "distribute", args: [t.address as Address], chain: wallet.chain, account: wallet.account! });
      const rc = await client.waitForTransactionReceipt({ hash });
      console.log(`[keeper] distribute ${t.address} estFee=${estFee} → ${rc.status} ${hash}`);
    }
    // Persist graduation once the pool crosses the threshold (emits Graduated for the indexer).
    if (!t.graduated && BigInt(t.paired_usdc) >= BigInt(t.graduation_threshold) && BigInt(t.graduation_threshold) > 0n) {
      const hash = await wallet.writeContract({ address: ADDR.factory, abi: factoryAbi, functionName: "markGraduated", args: [t.address as Address], chain: wallet.chain, account: wallet.account! });
      const rc = await client.waitForTransactionReceipt({ hash });
      console.log(`[keeper] markGraduated ${t.address} → ${rc.status} ${hash}`);
    }
  }
  await buyback(wallet);
}

/** Treasury buyback & burn: permissionless `execute()`, gated by the on-chain threshold. */
async function buyback(wallet: ReturnType<typeof keeperWallet>["wallet"]) {
  const [platformToken, bal, threshold, maxPer, fee] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "platformToken" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "usdcBalance" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "executeThreshold" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "maxPerExecute" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "platformPoolFee" },
    ],
  });
  if (platformToken === "0x0000000000000000000000000000000000000000" || bal < threshold || bal === 0n) return;
  const spend = maxPer > 0n && bal > maxPer ? maxPer : bal;
  const toBuy = (spend * 8_200n) / 10_000n;
  // slippage guard: quote the buy and accept 3% worse
  let minOut = 0n;
  try {
    const { result } = await client.simulateContract({
      address: ADDR.quoter, abi: quoterAbi, functionName: "quoteExactInputSingle",
      args: [{ tokenIn: ADDR.usdc, tokenOut: platformToken, amountIn: toBuy, fee, sqrtPriceLimitX96: 0n }],
    });
    minOut = (result[0] * 97n) / 100n;
  } catch (e) {
    console.warn("[keeper] buyback quote failed, using minOut=0:", (e as Error).message.split("\n")[0]);
  }
  const hash = await wallet.writeContract({ address: ADDR.treasury, abi: treasuryAbi, functionName: "execute", args: [minOut], chain: wallet.chain, account: wallet.account! });
  const rc = await client.waitForTransactionReceipt({ hash });
  console.log(`[keeper] treasury.execute spend=${spend} buy=${toBuy} minOut=${minOut} → ${rc.status} ${hash}`);
}
