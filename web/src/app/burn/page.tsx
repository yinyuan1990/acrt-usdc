"use client";

import { ExternalLink, Flame, Lock, Timer } from "lucide-react";
import { usd, useStats, useTreasury } from "@/lib/api";
import { fmtUsd } from "@/lib/format";
import { ADDR, addrUrl } from "@/lib/web3";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Empty, SectionTitle, Stat } from "@/components/shared";

const NEXT_RUN_THRESHOLD = 50; // USDC — Treasury.executeThreshold once configured

export default function BurnPage() {
  const { t } = useApp();
  const tr = useTreasury().data;
  const s = useStats().data;
  const treasury = usd(tr?.usdcBalance);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("burn.title")}</h1>
        <p className="mt-1 text-sm text-secondary-foreground">{t("burn.subtitle")}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("burn.treasury")} value={tr ? fmtUsd(treasury) : "…"} tone="primary" sub={<a className="font-mono hover:underline" href={addrUrl(ADDR.treasury)} target="_blank" rel="noreferrer">{ADDR.treasury.slice(0, 10)}…</a>} />
        <Stat label={t("burn.revenue")} value={tr ? fmtUsd(usd(tr.fromCreationFees) + usd(tr.fromTradeFees)) : "…"} sub={tr ? `${t("burn.fromCreation")} ${fmtUsd(usd(tr.fromCreationFees))} · ${t("burn.fromFees")} ${fmtUsd(usd(tr.fromTradeFees))}` : undefined} />
        <Stat label={t("explore.stat.fees")} value={s ? fmtUsd(usd(s.feesTotalUsdc)) : "…"} sub={s ? `24h ${fmtUsd(usd(s.fees24hUsdc))}` : undefined} />
        <Stat label={t("burn.burned")} value="0" tone="gold" sub={t("burn.noBurns")} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="label">{t("burn.split")}</CardTitle>
            <CardAction><Badge variant="secondary"><Lock /> {t("burn.immutable")}</Badge></CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex h-4 overflow-hidden rounded-full">
              <div className="bg-gold" style={{ width: `${(tr?.buybackBps ?? 8200) / 100}%` }} />
              <div className="bg-primary" style={{ width: `${(tr?.ecoBps ?? 1800) / 100}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted p-3">
                <div className="flex items-center gap-1.5 text-xs text-gold"><Flame size={12} /> {t("burn.buyback")}</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular">{(tr?.buybackBps ?? 8200) / 100}%</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs text-primary">{t("burn.eco")}</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular">{(tr?.ecoBps ?? 1800) / 100}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="label">{t("burn.nextRun")}</CardTitle>
            <CardAction><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Timer size={12} /> {t("burn.threshold")} {fmtUsd(NEXT_RUN_THRESHOLD)}</span></CardAction>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-3xl font-bold tabular">{fmtUsd(treasury)} <span className="text-base text-muted-foreground">/ {fmtUsd(NEXT_RUN_THRESHOLD)}</span></div>
            <Progress value={Math.min(100, (treasury / NEXT_RUN_THRESHOLD) * 100)} className="mt-3 h-2.5" indicatorClassName="bg-gold" shimmer />
            <p className="mt-3 text-xs text-muted-foreground">{t("burn.notStarted")}</p>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted p-3 text-xs">
              <span className="text-muted-foreground">Burn address</span>
              <span className="font-mono">0x000…dEaD</span>
            </div>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <a href={addrUrl(ADDR.treasury)} target="_blank" rel="noreferrer"><ExternalLink /> Treasury on ArcScan</a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionTitle>{t("burn.history")}</SectionTitle>
        <Empty>{t("burn.noBurns")}</Empty>
      </section>
    </div>
  );
}
