"use client";

import Link from "next/link";
import { TOKENS } from "@/lib/mock";
import { fmtUsd } from "@/lib/format";
import { useApp } from "@/components/providers";
import { PctChange } from "@/components/shared";

export function Ticker() {
  const { t } = useApp();
  const items = [...TOKENS].sort((a, b) => b.volume24h - a.volume24h).slice(0, 12);
  const row = (k: string) => (
    <div key={k} className="flex shrink-0 items-center">
      {items.map((tok) => (
        <Link
          key={k + tok.address}
          href={`/token/${tok.address}`}
          className="flex items-center gap-2 border-r px-4 py-1.5 text-xs hover:bg-accent"
        >
          <span>{tok.emoji}</span>
          <span className="font-semibold">{tok.symbol}</span>
          <span className="font-mono text-secondary-foreground tabular">{fmtUsd(tok.price)}</span>
          <PctChange value={tok.change24h} className="text-[11px]" />
        </Link>
      ))}
    </div>
  );
  return (
    <div className="flex items-stretch border-t bg-sidebar/60 text-xs">
      <div className="flex shrink-0 items-center gap-1.5 border-r px-3 font-mono text-[10px] text-primary">
        <span className="blink size-1.5 rounded-full bg-primary" />
        {t("common.live")}
      </div>
      <div className="no-scrollbar flex-1 overflow-hidden">
        <div className="marquee">{[row("a"), row("b")]}</div>
      </div>
    </div>
  );
}
