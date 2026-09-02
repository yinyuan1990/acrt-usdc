"use client";

import { ExternalLink, Flame, Lock, Timer } from "lucide-react";
import { BURN_HISTORY, PLATFORM, PLATFORM_STATS } from "@/lib/mock";
import { fmtNum, fmtPct, fmtUsd, shortAddr } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionTitle, Stat, TimeAgo } from "@/components/shared";

export default function BurnPage() {
  const { t } = useApp();
  const s = PLATFORM_STATS;
  const burnedPct = (s.arclBurned / s.arclSupply) * 100;
  const toNext = (s.treasury / s.nextRunThreshold) * 100;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("burn.title")}</h1>
        <p className="mt-1 text-sm text-secondary-foreground">{t("burn.subtitle")}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("burn.treasury")} value={fmtUsd(s.treasury)} tone="primary" />
        <Stat
          label={t("burn.revenue")}
          value={fmtUsd(s.totalRevenue, { compact: true })}
          sub={`${t("burn.fromCreation")} ${fmtUsd(s.fromCreation, { compact: true })} · ${t("burn.fromFees")} ${fmtUsd(s.fromFees, { compact: true })}`}
        />
        <Stat label={t("burn.burned")} value={fmtNum(s.arclBurned)} tone="gold" sub={`${fmtPct(burnedPct, false)} · ${fmtUsd(s.totalBurnedUsd, { compact: true })}`} />
        <Stat label={t("burn.supply")} value={fmtNum(s.arclSupply - s.arclBurned)} sub={`$ARCL ${fmtUsd(s.arclPrice)}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="label">{t("burn.split")}</CardTitle>
            <CardAction>
              <Badge variant="secondary">
                <Lock /> {t("burn.immutable")}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex h-4 overflow-hidden rounded-full">
              <div className="bg-gold" style={{ width: `${PLATFORM.buybackShare}%` }} />
              <div className="bg-primary" style={{ width: `${PLATFORM.ecoShare}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted p-3">
                <div className="flex items-center gap-1.5 text-xs text-gold">
                  <Flame size={12} /> {t("burn.buyback")}
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tabular">{PLATFORM.buybackShare}%</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs text-primary">{t("burn.eco")}</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular">{PLATFORM.ecoShare}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="label">{t("burn.nextRun")}</CardTitle>
            <CardAction>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Timer size={12} /> {t("burn.threshold")} {fmtUsd(s.nextRunThreshold, { compact: true })}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-3xl font-bold tabular">
              {fmtUsd(s.treasury)} <span className="text-base text-muted-foreground">/ {fmtUsd(s.nextRunThreshold, { compact: true })}</span>
            </div>
            <Progress value={toNext} className="mt-3 h-2.5" indicatorClassName="bg-gold" shimmer />
            <p className="mt-3 text-xs text-muted-foreground">{t("burn.notStarted")}</p>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted p-3 text-xs">
              <span className="text-muted-foreground">Burn address</span>
              <span className="font-mono">0x000…dEaD</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionTitle>{t("burn.history")}</SectionTitle>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.time")}</TableHead>
                <TableHead className="text-right">USDC</TableHead>
                <TableHead className="text-right">$ARCL</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Avg</TableHead>
                <TableHead className="text-right">{t("common.tx")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs tabular">
              {BURN_HISTORY.map((b) => (
                <TableRow key={b.hash}>
                  <TableCell className="text-muted-foreground">
                    <TimeAgo ts={b.time} /> ago
                  </TableCell>
                  <TableCell className="text-right">{fmtUsd(b.usdcSpent)}</TableCell>
                  <TableCell className="text-right text-gold">🔥 {fmtNum(b.arclBurned)}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">{fmtUsd(b.avgPrice)}</TableCell>
                  <TableCell className="text-right">
                    <a className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" href="#">
                      {shortAddr(b.hash, 6, 4)} <ExternalLink size={10} />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
