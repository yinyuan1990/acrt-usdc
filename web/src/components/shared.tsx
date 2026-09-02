"use client";

import { useSyncExternalStore } from "react";
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

export function TokenAvatar({ emoji, hue, size = 40, className }: { emoji: string; hue: number; size?: number; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-lg select-none", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 30%))`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.2)",
      }}
    >
      {emoji}
    </div>
  );
}

export function TimeAgo({ ts, className }: { ts: number; className?: string }) {
  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  return (
    <span className={cn("tabular", className)} suppressHydrationWarning>
      {now === null ? "…" : timeAgo(ts, now)}
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

export function PctChange({ value, className }: { value: number; className?: string }) {
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
