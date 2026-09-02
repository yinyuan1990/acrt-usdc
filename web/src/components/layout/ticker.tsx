"use client";

import Link from "next/link";
import { ACTIVITY, TOKENS } from "@/lib/mock";
import { fmtUsd, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { PctChange, TokenAvatar } from "@/components/shared";

/**
 * Two-row live strip, pump.fun style:
 *  row 1 — activity feed (wallet bought/sold $X of TOKEN, new launches)
 *  row 2 — price ticker for top tokens
 */
export function Ticker() {
  const { t } = useApp();
  const top = [...TOKENS].sort((a, b) => b.volume24h - a.volume24h).slice(0, 12);

  const activityRow = (k: string) => (
    <div key={k} className="flex shrink-0 items-center">
      {ACTIVITY.map((a) => (
        <Link key={k + a.id} href={`/token/${a.token.address}`} className="flex items-center gap-2 border-r px-3 py-1.5 text-xs hover:bg-accent">
          <span
            className="size-4 shrink-0 rounded-full"
            style={{ background: `linear-gradient(135deg, hsl(${parseInt(a.wallet.slice(2, 5), 16) % 360} 70% 50%), hsl(${parseInt(a.wallet.slice(5, 8), 16) % 360} 70% 35%))` }}
          />
          <span className="font-mono text-muted-foreground">{shortAddr(a.wallet, 4, 3)}</span>
          <span className={cn("font-medium", a.kind === "buy" ? "text-up" : a.kind === "sell" ? "text-down" : "text-gold")}>
            {a.kind === "buy" ? t("activity.bought") : a.kind === "sell" ? t("activity.sold") : t("activity.launched")}
          </span>
          {a.usdc !== undefined && <span className="font-mono tabular">{fmtUsd(a.usdc)}</span>}
          {a.usdc !== undefined && <span className="text-muted-foreground">{t("activity.of")}</span>}
          <TokenAvatar emoji={a.token.emoji} hue={a.token.hue} size={16} className="rounded-sm" />
          <span className="font-semibold">{a.token.symbol}</span>
        </Link>
      ))}
    </div>
  );

  const priceRow = (k: string) => (
    <div key={k} className="flex shrink-0 items-center">
      {top.map((tok) => (
        <Link key={k + tok.address} href={`/token/${tok.address}`} className="flex items-center gap-2 border-r px-4 py-1 text-[11px] hover:bg-accent">
          <span>{tok.emoji}</span>
          <span className="font-semibold">{tok.symbol}</span>
          <span className="font-mono text-secondary-foreground tabular">{fmtUsd(tok.price)}</span>
          <PctChange value={tok.change24h} className="text-[11px]" />
        </Link>
      ))}
    </div>
  );

  return (
    <div className="border-t bg-sidebar/60">
      <div className="flex items-stretch border-b">
        <div className="flex shrink-0 items-center gap-1.5 border-r px-3 font-mono text-[10px] text-primary">
          <span className="blink size-1.5 rounded-full bg-primary" />
          {t("common.live")}
        </div>
        <div className="no-scrollbar flex-1 overflow-hidden">
          <div className="marquee [animation-duration:90s]">{[activityRow("a"), activityRow("b")]}</div>
        </div>
      </div>
      <div className="no-scrollbar hidden overflow-hidden md:block">
        <div className="marquee">{[priceRow("a"), priceRow("b")]}</div>
      </div>
    </div>
  );
}
