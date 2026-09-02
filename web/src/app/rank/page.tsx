"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PLATFORM, SUPPLY, TOKENS } from "@/lib/mock";
import { fmtNum, fmtUsd } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Badge, PctChange, Tabs, TokenAvatar, cn } from "@/components/ui";

type Metric = "volume" | "gain" | "holders" | "creator";

export default function RankPage() {
  const { t } = useApp();
  const [metric, setMetric] = useState<Metric>("volume");

  const rows = useMemo(() => {
    const xs = [...TOKENS];
    switch (metric) {
      case "gain":
        return xs.sort((a, b) => b.change24h - a.change24h);
      case "holders":
        return xs.sort((a, b) => b.holders - a.holders);
      case "creator":
        return xs.sort((a, b) => b.feesEarned - a.feesEarned);
      default:
        return xs.sort((a, b) => b.volume24h - a.volume24h);
    }
  }, [metric]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{t("rank.title")}</h1>
        <Tabs<Metric>
          value={metric}
          onChange={setMetric}
          tabs={[
            { id: "volume", label: t("rank.byVolume") },
            { id: "gain", label: t("rank.byGain") },
            { id: "holders", label: t("rank.byHolders") },
            { id: "creator", label: t("rank.byCreator") },
          ]}
        />
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-normal">
              <th className="w-10">#</th>
              <th>{t("common.token")}</th>
              <th className="text-right">{t("common.price")}</th>
              <th className="text-right">{t("common.change24h")}</th>
              <th className="text-right">{t("common.mcap")}</th>
              <th className="text-right">{t("common.volume24h")}</th>
              <th className="text-right">{t("common.holders")}</th>
              <th className="text-right">{t("rank.byCreator")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tok, i) => (
              <tr key={tok.address} className="border-t border-line hover:bg-surface-2">
                <td className="px-4 py-3 font-mono text-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/token/${tok.address}`} className="flex items-center gap-3">
                    <TokenAvatar emoji={tok.emoji} hue={tok.hue} size={32} />
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        {tok.name}
                        {tok.graduated && <Badge tone="gold">{t("common.graduated")}</Badge>}
                      </div>
                      <div className="font-mono text-xs text-muted">${tok.symbol}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular">{fmtUsd(tok.price)}</td>
                <td className="px-4 py-3 text-right">
                  <PctChange value={tok.change24h} />
                </td>
                <td className="px-4 py-3 text-right font-mono tabular">{fmtUsd(tok.price * SUPPLY, { compact: true })}</td>
                <td className="px-4 py-3 text-right font-mono tabular">{fmtUsd(tok.volume24h, { compact: true })}</td>
                <td className="px-4 py-3 text-right font-mono tabular">{fmtNum(tok.holders)}</td>
                <td className="px-4 py-3 text-right font-mono text-up tabular">{fmtUsd(tok.feesEarned * (PLATFORM.creatorShare / 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((tok, i) => (
          <Link key={tok.address} href={`/token/${tok.address}`} className="card flex items-center gap-3 p-3">
            <span className={cn("w-5 font-mono text-sm", i < 3 ? "text-gold" : "text-muted")}>{i + 1}</span>
            <TokenAvatar emoji={tok.emoji} hue={tok.hue} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{tok.name}</span>
                <span className="font-mono text-xs text-muted">${tok.symbol}</span>
              </div>
              <div className="text-xs text-muted">
                {metric === "creator"
                  ? `${t("rank.byCreator")} ${fmtUsd(tok.feesEarned * (PLATFORM.creatorShare / 100))}`
                  : metric === "holders"
                    ? `${fmtNum(tok.holders)} ${t("common.holders")}`
                    : `${t("common.volume24h")} ${fmtUsd(tok.volume24h, { compact: true })}`}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm tabular">{fmtUsd(tok.price)}</div>
              <PctChange value={tok.change24h} className="text-xs" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
