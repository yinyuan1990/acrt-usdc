"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Info, Lock, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Token } from "@/lib/mock";
import { fmtNum, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TokenAvatar } from "@/components/shared";

const QUICK_USDC = [10, 50, 100, 500];
const QUICK_PCT = [25, 50, 75, 100];

type Side = "buy" | "sell";

/** Uniswap-style severity buckets for price impact. */
function impactTone(pct: number) {
  if (pct >= 10) return "text-down";
  if (pct >= 5) return "text-gold";
  return "";
}

export function TradePanel({ token, className, bare }: { token: Token; className?: string; bare?: boolean }) {
  const { t, connected, toggleConnect } = useApp();
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(2);
  const [review, setReview] = useState(false);

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
      return { out, impact: (inNet / (pooledUsdc + inNet)) * 100, fee: num * 0.01, rate: out > 0 ? num / out : token.price };
    }
    const out = pooledUsdc - (pooledUsdc * pooledTok) / (pooledTok + inNet);
    return { out, impact: (inNet / (pooledTok + inNet)) * 100, fee: out * 0.01, rate: num > 0 ? out / num : token.price };
  }, [num, side, token]);

  const minReceived = quote.out * (1 - slippage / 100);
  const recvLabel = side === "buy" ? `${fmtNum(quote.out)} ${token.symbol}` : fmtUsd(quote.out);
  const minLabel = side === "buy" ? `${fmtNum(minReceived)} ${token.symbol}` : fmtUsd(minReceived);

  const confirm = () => {
    setReview(false);
    setAmount("");
    toast.success(`${side === "buy" ? t("common.buy") : t("common.sell")} ${token.symbol}`, { description: `${side === "buy" ? fmtUsd(num) : fmtNum(num) + " " + token.symbol} → ${recvLabel}` });
  };

  const body = (
    <>
      <div className="flex items-center gap-2">
        <Tabs value={side} onValueChange={(v) => setSide(v as Side)} className="flex-1">
          <TabsList className="h-10 w-full">
            <TabsTrigger value="buy" className="font-semibold data-active:bg-up! data-active:text-black!">
              {t("common.buy")}
            </TabsTrigger>
            <TabsTrigger value="sell" className="font-semibold data-active:bg-down! data-active:text-white!">
              {t("common.sell")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon-lg" className="size-10" title={t("token.settings")}>
              <Settings2 />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="text-sm font-medium">{t("token.settings")}</div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("common.slippage")}</span>
              <span className="font-mono">{slippage}%</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[0.5, 1, 2, 5].map((s) => (
                <Button key={s} size="xs" variant={slippage === s ? "default" : "outline"} className="font-mono" onClick={() => setSlippage(s)}>
                  {s}%
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("token.slippageHint")}</p>
          </PopoverContent>
        </Popover>
      </div>

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
          <span className="flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 font-mono text-xs">
            {side === "buy" ? <span className="size-3.5 rounded-full bg-[#2775ca]" /> : <TokenAvatar emoji={token.emoji} hue={token.hue} size={14} className="rounded-sm" />}
            {side === "buy" ? "USDC" : token.symbol}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {(side === "buy" ? QUICK_USDC : QUICK_PCT).map((q) => (
            <Button key={q} variant="outline" size="xs" className="font-mono" onClick={() => setAmount(side === "buy" ? String(q) : String(Math.floor((tokenBalance * q) / 100)))}>
              {side === "buy" ? `$${q}` : `${q}%`}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-lg bg-muted p-3 text-xs">
        <Row label={t("token.youReceive")} value={num ? recvLabel : "—"} strong />
        <Row label={t("token.minReceived")} value={num ? minLabel : "—"} />
        <Row label={t("token.priceImpact")} value={num ? `${quote.impact.toFixed(2)}%` : "—"} className={impactTone(quote.impact)} />
        <Row label={`${t("common.fee")} (1%)`} value={num ? fmtUsd(quote.fee) : "—"} />
        <Row label={t("common.slippage")} value={`${slippage}%`} />
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
        onClick={connected ? () => setReview(true) : toggleConnect}
        disabled={connected && num <= 0}
      >
        {connected ? `${t("token.review")}` : t("common.connect")}
      </Button>

      <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Lock size={11} /> {t("token.lpLocked")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Info size={11} /> {t("common.finality")}
        </span>
      </div>

      {/* Review dialog (Uniswap pattern: quote summary → confirm) */}
      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("token.review")}</DialogTitle>
            <DialogDescription>
              {side === "buy" ? t("common.buy") : t("common.sell")} {token.symbol} · {t("common.usdcSettled")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-lg bg-muted p-3">
              <div className="text-[11px] text-muted-foreground">{t("token.youPay")}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-xl font-semibold tabular">{side === "buy" ? fmtUsd(num) : fmtNum(num)}</span>
                <span className="font-mono text-sm">{side === "buy" ? "USDC" : token.symbol}</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-[11px] text-muted-foreground">{t("token.youReceive")}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-xl font-semibold tabular">{side === "buy" ? fmtNum(quote.out) : fmtUsd(quote.out)}</span>
                <span className="font-mono text-sm">{side === "buy" ? token.symbol : "USDC"}</span>
              </div>
            </div>
            <Separator className="my-1" />
            <div className="space-y-1.5 text-xs">
              <Row label={t("token.rate")} value={`1 ${token.symbol} = ${fmtUsd(quote.rate)}`} />
              <Row label={t("token.minReceived")} value={minLabel} />
              <Row label={t("token.priceImpact")} value={`${quote.impact.toFixed(2)}%`} className={impactTone(quote.impact)} />
              <Row label={`${t("common.fee")} (1%)`} value={fmtUsd(quote.fee)} />
              <Row label="Gas" value="~$0.01 USDC" />
            </div>
            {quote.impact >= 5 && (
              <div className={cn("flex items-start gap-2 rounded-lg p-2.5 text-[11px]", quote.impact >= 10 ? "bg-down/15 text-down" : "bg-gold/15 text-gold")}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t("token.impactHigh")}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button size="xl" variant={side === "buy" ? "up" : "down"} className="w-full" onClick={confirm}>
              {t("token.confirm")} {side === "buy" ? t("common.buy") : t("common.sell")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (bare) return <div className={className}>{body}</div>;
  return (
    <Card className={className}>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function Row({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono tabular", strong && "font-semibold text-foreground", className)}>{value}</span>
    </div>
  );
}
