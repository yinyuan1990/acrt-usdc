"use client";

import Link from "next/link";
import { TOKENS } from "@/lib/mock";
import { fmtUsd } from "@/lib/format";
import { useApp } from "@/components/providers";
import { PctChange } from "@/components/ui";

export function Ticker() {
  const { t } = useApp();
  const items = [...TOKENS].sort((a, b) => b.volume24h - a.volume24h).slice(0, 12);
  const row = (k: string) => (
    <div key={k} className="flex shrink-0 items-center">
      {items.map((tok) => (
        <Link
          key={k + tok.address}
          href={`/token/${tok.address}`}
          className="flex items-center gap-2 border-r border-line px-4 py-1.5 text-xs hover:bg-surface-2"
        >
          <span>{tok.emoji}</span>
          <span className="font-semibold">{tok.symbol}</span>
          <span className="font-mono text-fg-2 tabular">{fmtUsd(tok.price)}</span>
          <PctChange value={tok.change24h} className="text-[11px]" />
        </Link>
      ))}
    </div>
  );
  return (
    <div className="flex items-stretch border-t border-line bg-bg-2/60 text-xs">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-line px-3 font-mono text-[10px] text-accent">
        <span className="h-1.5 w-1.5 rounded-pill bg-accent blink" />
        {t("common.live")}
      </div>
      <div className="no-scrollbar flex-1 overflow-hidden">
        <div className="marquee">{[row("a"), row("b")]}</div>
      </div>
    </div>
  );
}
