"use client";

import { useMemo, useState } from "react";
import { Info, Lock, ShieldCheck } from "lucide-react";
import type { Token } from "@/lib/mock";
import { fmtNum, fmtUsd } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Button, cn } from "@/components/ui";

const QUICK_USDC = [10, 50, 100, 500];
const QUICK_PCT = [25, 50, 75, 100];

export function TradePanel({ token, className }: { token: Token; className?: string }) {
  const { t, connected, toggleConnect } = useApp();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(2);

  const usdcBalance = 1_240.55;
  const tokenBalance = 4_820_000;

  const num = parseFloat(amount) || 0;
  const quote = useMemo(() => {
    // Simplified constant-product estimate for UI only.
    const pooledUsdc = Math.max(token.pairedUsdc, 200);
    const pooledTok = pooledUsdc / token.price;
    if (side === "buy") {
      const inNet = num * 0.99;
      const out = pooledTok - (pooledUsdc * pooledTok) / (pooledUsdc + inNet);
      const impact = pooledUsdc > 0 ? (inNet / (pooledUsdc + inNet)) * 100 : 0;
      return { out, impact, fee: num * 0.01 };
    }
    const inNet = num * 0.99;
    const out = pooledUsdc - (pooledUsdc * pooledTok) / (pooledTok + inNet);
    const impact = pooledTok > 0 ? (inNet / (pooledTok + inNet)) * 100 : 0;
    return { out, impact, fee: out * 0.01 };
  }, [num, side, token]);

  const minReceived = quote.out * (1 - slippage / 100);

  return (
    <div className={cn("card p-4", className)}>
      <div className="grid grid-cols-2 gap-1 rounded-btn bg-surface-2 p-1">
        <button
          onClick={() => setSide("buy")}
          className={cn("rounded-xs py-2 text-sm font-semibold transition-colors", side === "buy" ? "bg-up text-black" : "text-muted hover:text-fg")}
        >
          {t("common.buy")}
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn("rounded-xs py-2 text-sm font-semibold transition-colors", side === "sell" ? "bg-down text-white" : "text-muted hover:text-fg")}
        >
          {t("common.sell")}
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>{t("token.youPay")}</span>
          <span className="font-mono tabular">
            {t("common.balance")}: {side === "buy" ? `${fmtNum(usdcBalance, 2)} USDC` : `${fmtNum(tokenBalance)} ${token.symbol}`}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-btn border border-line bg-surface-2 px-3 py-2 focus-within:border-accent">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-xl outline-none tabular placeholder:text-muted"
          />
          <span className="rounded-xs bg-surface-3 px-2 py-1 font-mono text-xs">{side === "buy" ? "USDC" : token.symbol}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {(side === "buy" ? QUICK_USDC : QUICK_PCT).map((q) => (
            <button
              key={q}
              onClick={() => setAmount(side === "buy" ? String(q) : String(Math.floor((tokenBalance * q) / 100)))}
              className="rounded-xs border border-line py-1 font-mono text-[11px] text-fg-2 hover:bg-surface-2"
            >
              {side === "buy" ? `$${q}` : `${q}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-btn bg-surface-2 p-3 text-xs">
        <Row label={t("token.youReceive")} value={num ? `${side === "buy" ? fmtNum(quote.out) : fmtUsd(quote.out)} ${side === "buy" ? token.symbol : ""}` : "—"} strong />
        <Row label={t("token.minReceived")} value={num ? `${side === "buy" ? fmtNum(minReceived) : fmtUsd(minReceived)}` : "—"} />
        <Row label={t("token.priceImpact")} value={num ? `${quote.impact.toFixed(2)}%` : "—"} tone={quote.impact > 5 ? "down" : undefined} />
        <Row label={`${t("common.fee")} (1%)`} value={num ? fmtUsd(quote.fee) : "—"} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted">{t("common.slippage")}</span>
          <div className="flex gap-1">
            {[0.5, 1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={cn("rounded-xs px-1.5 py-0.5 font-mono text-[11px]", slippage === s ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {token.protectionActive && (
        <div className="mt-3 flex items-start gap-2 rounded-btn bg-gold-soft p-2.5 text-[11px] text-gold">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          {t("token.protectionActive")}
        </div>
      )}

      <Button
        size="lg"
        variant={connected ? (side === "buy" ? "up" : "down") : "primary"}
        className="mt-4 w-full"
        onClick={connected ? undefined : toggleConnect}
        disabled={connected && num <= 0}
      >
        {connected ? `${side === "buy" ? t("common.buy") : t("common.sell")} ${token.symbol}` : t("common.connect")}
      </Button>

      <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Lock size={11} /> {t("token.lpLocked")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Info size={11} /> {t("common.finality")}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "down" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn("font-mono tabular", strong && "font-semibold text-fg", tone === "down" && "text-down")}>{value}</span>
    </div>
  );
}
