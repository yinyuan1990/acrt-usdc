"use client";

import { useMemo, useState } from "react";
import { Info, Lock, ShieldCheck } from "lucide-react";
import type { Token } from "@/lib/mock";
import { fmtNum, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const QUICK_USDC = [10, 50, 100, 500];
const QUICK_PCT = [25, 50, 75, 100];

type Side = "buy" | "sell";

export function TradePanel({ token, className, bare }: { token: Token; className?: string; bare?: boolean }) {
  const { t, connected, toggleConnect } = useApp();
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(2);

  const usdcBalance = 1_240.55;
  const tokenBalance = 4_820_000;

  const num = parseFloat(amount) || 0;
  const quote = useMemo(() => {
    // Simplified constant-product estimate for UI only.
    const pooledUsdc = Math.max(token.pairedUsdc, 200);
    const pooledTok = pooledUsdc / token.price;
    const inNet = num * 0.99;
    if (side === "buy") {
      const out = pooledTok - (pooledUsdc * pooledTok) / (pooledUsdc + inNet);
      return { out, impact: (inNet / (pooledUsdc + inNet)) * 100, fee: num * 0.01 };
    }
    const out = pooledUsdc - (pooledUsdc * pooledTok) / (pooledTok + inNet);
    return { out, impact: (inNet / (pooledTok + inNet)) * 100, fee: out * 0.01 };
  }, [num, side, token]);

  const minReceived = quote.out * (1 - slippage / 100);

  const body = (
    <>
      <Tabs value={side} onValueChange={(v) => setSide(v as Side)}>
        <TabsList className="h-10 w-full">
          <TabsTrigger value="buy" className="font-semibold data-active:bg-up! data-active:text-black!">
            {t("common.buy")}
          </TabsTrigger>
          <TabsTrigger value="sell" className="font-semibold data-active:bg-down! data-active:text-white!">
            {t("common.sell")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("token.youPay")}</span>
          <span className="font-mono tabular">
            {t("common.balance")}: {side === "buy" ? `${fmtNum(usdcBalance, 2)} USDC` : `${fmtNum(tokenBalance)} ${token.symbol}`}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-input bg-muted px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-xl outline-none tabular placeholder:text-muted-foreground"
          />
          <span className="rounded-md bg-accent px-2 py-1 font-mono text-xs">{side === "buy" ? "USDC" : token.symbol}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {(side === "buy" ? QUICK_USDC : QUICK_PCT).map((q) => (
            <Button
              key={q}
              variant="outline"
              size="xs"
              className="font-mono"
              onClick={() => setAmount(side === "buy" ? String(q) : String(Math.floor((tokenBalance * q) / 100)))}
            >
              {side === "buy" ? `$${q}` : `${q}%`}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-lg bg-muted p-3 text-xs">
        <Row label={t("token.youReceive")} value={num ? `${side === "buy" ? fmtNum(quote.out) : fmtUsd(quote.out)} ${side === "buy" ? token.symbol : ""}` : "—"} strong />
        <Row label={t("token.minReceived")} value={num ? `${side === "buy" ? fmtNum(minReceived) : fmtUsd(minReceived)}` : "—"} />
        <Row label={t("token.priceImpact")} value={num ? `${quote.impact.toFixed(2)}%` : "—"} warn={quote.impact > 5} />
        <Row label={`${t("common.fee")} (1%)`} value={num ? fmtUsd(quote.fee) : "—"} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground">{t("common.slippage")}</span>
          <div className="flex gap-1">
            {[0.5, 1, 2, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlippage(s)}
                className={cn("rounded-md px-1.5 py-0.5 font-mono text-[11px]", slippage === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {token.protectionActive && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-gold/15 p-2.5 text-[11px] text-gold">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          {t("token.protectionActive")}
        </div>
      )}

      <Button
        size="xl"
        variant={connected ? (side === "buy" ? "up" : "down") : "glow"}
        className="mt-4 w-full"
        onClick={connected ? undefined : toggleConnect}
        disabled={connected && num <= 0}
      >
        {connected ? `${side === "buy" ? t("common.buy") : t("common.sell")} ${token.symbol}` : t("common.connect")}
      </Button>

      <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Lock size={11} /> {t("token.lpLocked")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Info size={11} /> {t("common.finality")}
        </span>
      </div>
    </>
  );

  if (bare) return <div className={className}>{body}</div>;
  return (
    <Card className={className}>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function Row({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono tabular", strong && "font-semibold text-foreground", warn && "text-down")}>{value}</span>
    </div>
  );
}
