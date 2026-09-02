"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { shortAddr, timeAgo } from "@/lib/format";
import { clockStore } from "@/lib/store";
import { useApp } from "@/components/providers";
import { Card, CardContent } from "@/components/ui/card";

/** KPI tile built on shadcn Card. */
export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "up" | "down" | "primary" | "gold";
  className?: string;
}) {
  const toneCls = tone ? { up: "text-up", down: "text-down", primary: "text-primary", gold: "text-gold" }[tone] : "text-foreground";
  return (
    <Card size="sm" className={className}>
      <CardContent>
        <div className="label">{label}</div>
        <div className={cn("mt-1 font-mono text-xl font-semibold tabular md:text-2xl", toneCls)}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/** Deterministic hue from an address so fallbacks stay stable. */
export function hueOf(seed: string): number {
  let h = 0;
  for (let i = 2; i < Math.min(seed.length, 14); i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** Token avatar: on-chain logo URL if it loads, otherwise a gradient tile with the symbol's first letters. */
export function TokenAvatar({ logo, symbol, seed, size = 40, className }: { logo?: string; symbol: string; seed: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const hue = hueOf(seed);
  const showImg = !!logo && /^https?:\/\//.test(logo) && !broken;
  // "emoji:🚀" is the no-upload path used by the create form.
  const emoji = logo?.startsWith("emoji:") ? logo.slice(6) : null;
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg font-bold text-white select-none", className)}
      style={{
        width: size,
        height: size,
        fontSize: emoji ? size * 0.5 : size * 0.36,
        background: showImg ? undefined : `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 30%))`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.2)",
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={symbol} width={size} height={size} className="size-full object-cover" onError={() => setBroken(true)} />
      ) : (
        emoji ?? symbol.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

/** Small circular identicon for wallets. */
export function WalletDot({ address, size = 16, className }: { address: string; size?: number; className?: string }) {
  const h1 = hueOf(address);
  const h2 = (h1 + 90) % 360;
  return <span className={cn("inline-block shrink-0 rounded-full", className)} style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${h1} 70% 50%), hsl(${h2} 70% 35%))` }} />;
}

export function TimeAgo({ ts, className }: { ts: number | string; className?: string }) {
  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const ms = typeof ts === "string" ? new Date(ts).getTime() : ts;
  return (
    <span className={cn("tabular", className)} suppressHydrationWarning>
      {now === null ? "…" : timeAgo(ms, now)}
    </span>
  );
}

export function Addr({ value, head = 6, tail = 4, className }: { value: string; head?: number; tail?: number; className?: string }) {
  const { t } = useApp();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success(t("common.copied"), { description: value });
        } catch {}
      }}
      title={t("common.copy")}
      className={cn("inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground", className)}
    >
      {shortAddr(value, head, tail)}
      <Copy size={12} />
    </button>
  );
}

export function PctChange({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className={cn("font-mono text-muted-foreground", className)}>—</span>;
  const up = value >= 0;
  return (
    <span className={cn("font-mono tabular", up ? "text-up" : "text-down", className)}>
      {up ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

export function SectionTitle({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold md:text-base">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

/** Wraps a wagmi/viem error into a short toast-friendly message. */
export function errMsg(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string }) ?? {};
  const s = m.shortMessage ?? m.message ?? String(e);
  return s.split("\n")[0].slice(0, 160);
}
