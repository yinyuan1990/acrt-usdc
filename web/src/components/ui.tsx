"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { shortAddr, timeAgo } from "@/lib/format";
import { clockStore } from "@/lib/store";
import { useApp } from "@/components/providers";

export function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "up" | "down" | "gold";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-btn transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  }[size];
  const variants = {
    primary: "bg-accent text-accent-fg hover:bg-accent-hi shadow-glow",
    ghost: "bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg",
    outline: "border border-line-strong text-fg hover:bg-surface-2",
    up: "bg-up text-black hover:brightness-110",
    down: "bg-down text-white hover:brightness-110",
    gold: "bg-gold text-black hover:brightness-110",
  }[variant];
  return <button className={cn(base, sizes, variants, className)} {...rest} />;
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "accent" | "up" | "down" | "gold";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-fg-2 border-line",
    accent: "bg-accent-soft text-accent-hi border-transparent",
    up: "bg-up-soft text-up border-transparent",
    down: "bg-down-soft text-down border-transparent",
    gold: "bg-gold-soft text-gold border-transparent",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-medium leading-4",
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

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
  tone?: "up" | "down" | "accent" | "gold";
  className?: string;
}) {
  const toneCls = tone ? { up: "text-up", down: "text-down", accent: "text-accent-hi", gold: "text-gold" }[tone] : "text-fg";
  return (
    <div className={cn("card p-4", className)}>
      <div className="label text-[11px] text-muted">{label}</div>
      <div className={cn("mt-1 font-mono text-xl font-semibold tabular md:text-2xl", toneCls)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Progress({ value, tone = "accent", className, thin }: { value: number; tone?: "accent" | "gold" | "up"; className?: string; thin?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const bar = { accent: "bg-accent", gold: "bg-gold", up: "bg-up" }[tone];
  return (
    <div className={cn("relative w-full overflow-hidden rounded-pill bg-surface-3", thin ? "h-1.5" : "h-2.5", className)}>
      <div className={cn("relative h-full rounded-pill transition-[width] duration-700", bar)} style={{ width: `${pct}%` }}>
        <div className="shimmer absolute inset-0" />
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-btn bg-surface-2 p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "shrink-0 rounded-xs px-3 py-1.5 text-xs font-medium transition-colors md:text-sm",
            value === t.id ? "bg-surface-3 text-fg shadow-card" : "text-muted hover:text-fg",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TokenAvatar({ emoji, hue, size = 40, className }: { emoji: string; hue: number; size?: number; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-btn select-none", className)}
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
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      title={copied ? t("common.copied") : t("common.copy")}
      className={cn("inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-fg", className)}
    >
      {shortAddr(value, head, tail)}
      {copied ? <Check size={12} className="text-up" /> : <Copy size={12} />}
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
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="label text-sm font-semibold text-fg md:text-base">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card flex items-center justify-center p-10 text-sm text-muted">{children}</div>;
}
