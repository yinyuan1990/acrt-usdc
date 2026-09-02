"use client";

import { ExternalLink, Flame, Lock, Timer } from "lucide-react";
import { BURN_HISTORY, PLATFORM, PLATFORM_STATS } from "@/lib/mock";
import { fmtNum, fmtPct, fmtUsd, shortAddr } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Badge, Progress, SectionTitle, Stat, TimeAgo } from "@/components/ui";

export default function BurnPage() {
  const { t } = useApp();
  const s = PLATFORM_STATS;
  const burnedPct = (s.arclBurned / s.arclSupply) * 100;
  const toNext = (s.treasury / s.nextRunThreshold) * 100;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{t("burn.title")}</h1>
        <p className="mt-1 text-sm text-fg-2">{t("burn.subtitle")}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("burn.treasury")} value={fmtUsd(s.treasury)} tone="accent" />
        <Stat label={t("burn.revenue")} value={fmtUsd(s.totalRevenue, { compact: true })} sub={`${t("burn.fromCreation")} ${fmtUsd(s.fromCreation, { compact: true })} · ${t("burn.fromFees")} ${fmtUsd(s.fromFees, { compact: true })}`} />
        <Stat label={t("burn.burned")} value={fmtNum(s.arclBurned)} tone="gold" sub={`${fmtPct(burnedPct, false)} · ${fmtUsd(s.totalBurnedUsd, { compact: true })}`} />
        <Stat label={t("burn.supply")} value={fmtNum(s.arclSupply - s.arclBurned)} sub={`$ARCL ${fmtUsd(s.arclPrice)}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="label text-[11px] text-muted">{t("burn.split")}</div>
            <Badge>
              <Lock size={10} /> {t("burn.immutable")}
            </Badge>
          </div>
          <div className="mt-4 flex h-4 overflow-hidden rounded-pill">
            <div className="bg-gold" style={{ width: `${PLATFORM.buybackShare}%` }} />
            <div className="bg-accent" style={{ width: `${PLATFORM.ecoShare}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-btn bg-surface-2 p-3">
              <div className="flex items-center gap-1.5 text-xs text-gold">
                <Flame size={12} /> {t("burn.buyback")}
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tabular">{PLATFORM.buybackShare}%</div>
            </div>
            <div className="rounded-btn bg-surface-2 p-3">
              <div className="text-xs text-accent-hi">{t("burn.eco")}</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular">{PLATFORM.ecoShare}%</div>
            </div>
          </div>
        </div>

        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="label text-[11px] text-muted">{t("burn.nextRun")}</div>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Timer size={12} /> {t("burn.threshold")} {fmtUsd(s.nextRunThreshold, { compact: true })}
            </span>
          </div>
          <div className="mt-4 font-mono text-3xl font-bold tabular">
            {fmtUsd(s.treasury)} <span className="text-base text-muted">/ {fmtUsd(s.nextRunThreshold, { compact: true })}</span>
          </div>
          <Progress value={toNext} tone="gold" className="mt-3" />
          <p className="mt-3 text-xs text-muted">{t("burn.notStarted")}</p>
          <div className="mt-3 flex items-center justify-between rounded-btn bg-surface-2 p-3 text-xs">
            <span className="text-muted">Burn address</span>
            <span className="font-mono">0x000…dEaD</span>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>{t("burn.history")}</SectionTitle>
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-normal">
                <th>{t("common.time")}</th>
                <th className="text-right">USDC</th>
                <th className="text-right">$ARCL</th>
                <th className="hidden text-right sm:table-cell">Avg</th>
                <th className="text-right">{t("common.tx")}</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {BURN_HISTORY.map((b) => (
                <tr key={b.hash} className="border-t border-line hover:bg-surface-2 [&>td]:px-4 [&>td]:py-2.5">
                  <td className="text-muted">
                    <TimeAgo ts={b.time} /> ago
                  </td>
                  <td className="text-right">{fmtUsd(b.usdcSpent)}</td>
                  <td className="text-right text-gold">🔥 {fmtNum(b.arclBurned)}</td>
                  <td className="hidden text-right sm:table-cell">{fmtUsd(b.avgPrice)}</td>
                  <td className="text-right">
                    <a className="inline-flex items-center gap-1 text-muted hover:text-fg" href="#">
                      {shortAddr(b.hash, 6, 4)} <ExternalLink size={10} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
