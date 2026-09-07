import type { Address } from "viem";
import { client, keeperWallet, ADDR } from "./chain.js";
import { config } from "./config.js";
import { sql } from "./db.js";
import { factoryAbi, lockerAbi, treasuryAbi, quoterAbi } from "./abi.js";
import { keeperLog, keeperTicked } from "./keeper-log.js";

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
      keeperLog({ action: "error", detail: (e as Error).message.split("\n")[0], ok: false });
    }
    keeperTicked();
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
      // Slippage guard for the token→USDC conversion inside distribute: dry-run with minOut=0 to learn
      // how much USDC the token-side fees fetch right now, then require 97% of that on the real call.
      let minOut = 0n;
      try {
        const { result } = await client.simulateContract({
          address: ADDR.locker, abi: lockerAbi, functionName: "distribute", args: [t.address as Address, 0n], account: wallet.account!,
        });
        minOut = (result[1] * 97n) / 100n;
      } catch (e) {
        console.warn(`[keeper] distribute dry-run failed for ${t.address}, using minOut=0:`, (e as Error).message.split("\n")[0]);
      }
      // wallet client is bound to the local private-key account → signs locally, no eth_sendTransaction
      const hash = await wallet.writeContract({ address: ADDR.locker, abi: lockerAbi, functionName: "distribute", args: [t.address as Address, minOut], chain: wallet.chain, account: wallet.account! });
      const rc = await client.waitForTransactionReceipt({ hash });
      console.log(`[keeper] distribute ${t.address} estFee=${estFee} minOut=${minOut} → ${rc.status} ${hash}`);
      keeperLog({ action: "distribute", token: t.address, detail: `estFee=${estFee} minOut=${minOut}`, hash, ok: rc.status === "success" });
    }
    // Persist graduation once the pool crosses the threshold (emits Graduated for the indexer).
    if (!t.graduated && BigInt(t.paired_usdc) >= BigInt(t.graduation_threshold) && BigInt(t.graduation_threshold) > 0n) {
      const hash = await wallet.writeContract({ address: ADDR.factory, abi: factoryAbi, functionName: "markGraduated", args: [t.address as Address], chain: wallet.chain, account: wallet.account! });
      const rc = await client.waitForTransactionReceipt({ hash });
      console.log(`[keeper] markGraduated ${t.address} → ${rc.status} ${hash}`);
      keeperLog({ action: "markGraduated", token: t.address, detail: `paired=${t.paired_usdc}`, hash, ok: rc.status === "success" });
    }
  }
  await buyback(wallet);
}

/** Treasury: weekly `execute()` (80% → eco multisig, 20% → buyback reserve, first slice bought), then
 *  `buyback()` slices every BUYBACK_COOLDOWN until the reserve is spent. Both are permissionless and both
 *  enforce a TWAP floor + impact cap on-chain; the quote-based minOut here is only a second belt. */
async function buyback(wallet: ReturnType<typeof keeperWallet>["wallet"]) {
  const ZERO = "0x0000000000000000000000000000000000000000";
  const [platformToken, nextAt, pending, reserve, fee, nextBuyAt, sliceNow] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "platformToken" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "nextExecuteAt" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "pendingRevenue" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "buybackReserve" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "platformPoolFee" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "nextBuybackAt" },
      { address: ADDR.treasury, abi: treasuryAbi, functionName: "nextBuybackAmount" },
    ],
  });
  const now = BigInt(Math.floor(Date.now() / 1000));
  const configured = platformToken !== ZERO;

  const quoteMin = async (amountIn: bigint) => {
    if (!configured || amountIn === 0n) return 0n;
    try {
      const { result } = await client.simulateContract({
        address: ADDR.quoter, abi: quoterAbi, functionName: "quoteExactInputSingle",
        args: [{ tokenIn: ADDR.usdc, tokenOut: platformToken, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      return (result[0] * 97n) / 100n;
    } catch (e) {
      console.warn("[keeper] buyback quote failed, relying on the on-chain TWAP floor:", (e as Error).message.split("\n")[0]);
      return 0n;
    }
  };

  // 1) weekly settlement
  if (now >= nextAt) {
    const toEco = (pending * 8_000n) / 10_000n;
    const newReserve = pending - toEco + reserve;
    if (toEco > 0n || (configured && newReserve > 0n && sliceNow > 0n)) {
      const minOut = await quoteMin(sliceNow < newReserve ? sliceNow : newReserve);
      const hash = await wallet.writeContract({ address: ADDR.treasury, abi: treasuryAbi, functionName: "execute", args: [minOut], chain: wallet.chain, account: wallet.account! });
      const rc = await client.waitForTransactionReceipt({ hash });
      const detail = `eco=${toEco} reserve=${newReserve} firstSlice≈${sliceNow} minOut=${minOut}`;
      console.log(`[keeper] treasury.execute ${detail} → ${rc.status} ${hash}`);
      keeperLog({ action: "execute", detail, hash, ok: rc.status === "success" });
      return; // next tick picks up the remaining slices
    }
  }

  // 2) buyback slices between settlements
  if (configured && reserve > 0n && sliceNow > 0n && now >= nextBuyAt) {
    const minOut = await quoteMin(sliceNow);
    const hash = await wallet.writeContract({ address: ADDR.treasury, abi: treasuryAbi, functionName: "buyback", args: [minOut], chain: wallet.chain, account: wallet.account! });
    const rc = await client.waitForTransactionReceipt({ hash });
    const detail = `slice=${sliceNow} reserveBefore=${reserve} minOut=${minOut}`;
    console.log(`[keeper] treasury.buyback ${detail} → ${rc.status} ${hash}`);
    keeperLog({ action: "buyback", detail, hash, ok: rc.status === "success" });
  }
}
