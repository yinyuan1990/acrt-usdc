"use client";

import Link from "next/link";
import { ExternalLink, Flame, Lock, Timer } from "lucide-react";
import { usd, useStats, useTreasury } from "@/lib/api";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { ADDR, addrUrl, txUrl } from "@/lib/web3";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, PctChange, SectionTitle, Stat, TimeAgo, TokenAvatar } from "@/components/shared";

const SUPPLY = 1_000_000_000;

export default function BurnPage() {
  const { t } = useApp();
  const tr = useTreasury().data;
  const s = useStats().data;
  const treasury = usd(tr?.usdcBalance);
  const threshold = usd(tr?.executeThreshold) || 1;
  const burned = tr ? Number(tr.totalBurned) / 1e18 : 0;
  const pt = tr?.platformToken ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("burn.title")}</h1>
        <p className="mt-1 text-sm text-secondary-foreground">{t("burn.subtitle")}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("burn.treasury")} value={tr ? fmtUsd(treasury) : "…"} tone="primary" sub={<a className="font-mono hover:underline" href={addrUrl(ADDR.treasury)} target="_blank" rel="noreferrer">{shortAddr(ADDR.treasury, 8, 6)}</a>} />
        <Stat label={t("burn.revenue")} value={tr ? fmtUsd(usd(tr.fromCreationFees) + usd(tr.fromTradeFees)) : "…"} sub={tr ? `${t("burn.fromCreation")} ${fmtUsd(usd(tr.fromCreationFees))} · ${t("burn.fromFees")} ${fmtUsd(usd(tr.fromTradeFees))}` : undefined} />
        <Stat label={t("burn.boughtBack")} value={tr ? fmtUsd(usd(tr.totalBoughtBackUsdc)) : "…"} tone="gold" sub={tr ? `${t("burn.toEco")} ${fmtUsd(usd(tr.totalToEcoUsdc))}` : undefined} />
        <Stat label={t("burn.burned")} value={tr ? `${fmtNum(burned)} ${pt?.symbol ?? "ARCL"}` : "…"} tone="gold" sub={tr ? `${((burned / SUPPLY) * 100).toFixed(3)}% · ${fmtUsd(burned * (pt?.price ?? 0))}` : undefined} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
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
            <CardAction><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Timer size={12} /> {t("burn.threshold")} {fmtUsd(threshold)}</span></CardAction>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-3xl font-bold tabular">{fmtUsd(treasury)} <span className="text-base text-muted-foreground">/ {fmtUsd(threshold)}</span></div>
            <Progress value={Math.min(100, (treasury / threshold) * 100)} className="mt-3 h-2.5" indicatorClassName="bg-gold" shimmer />
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("burn.perExecute")}</span><span className="font-mono">{fmtUsd(usd(tr?.maxPerExecute))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Burn address</span><span className="font-mono">0x000…dEaD</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("burn.eco")}</span><span className="font-mono">{tr ? shortAddr(tr.ecoFund, 6, 4) : "…"}</span></div>
            </div>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <a href={addrUrl(ADDR.treasury)} target="_blank" rel="noreferrer"><ExternalLink /> Treasury on ArcScan</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="label">{t("burn.platformToken")}</CardTitle></CardHeader>
          <CardContent>
            {pt ? (
              <Link href={`/token/${pt.address}`} className="block">
                <div className="flex items-center gap-3">
                  <TokenAvatar logo={pt.logo} symbol={pt.symbol} seed={pt.address} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-semibold">{pt.name}</span><span className="font-mono text-xs text-muted-foreground">${pt.symbol}</span></div>
                    <div className="flex items-center gap-2 text-sm"><span className="font-mono tabular">{fmtUsd(pt.price)}</span><PctChange value={pt.change24h} className="text-xs" /></div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">{t("common.mcap")}</div><div className="font-mono font-semibold tabular">{fmtUsd(pt.mcapUsd, { compact: true })}</div></div>
                  <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">{t("burn.supply")}</div><div className="font-mono font-semibold tabular">{fmtNum(SUPPLY - burned)}</div></div>
                </div>
              </Link>
            ) : (
              <div className="text-sm text-muted-foreground">{t("burn.notStarted")}</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionTitle right={<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><span className="blink size-1.5 rounded-full bg-gold" /> {t("burn.live")}</span>}>{t("burn.history")}</SectionTitle>
        {!tr || tr.burns.length === 0 ? (
          <Empty>{t("burn.noBurns")}</Empty>
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.time")}</TableHead>
                  <TableHead className="text-right">USDC</TableHead>
                  <TableHead className="text-right">🔥 {pt?.symbol ?? "ARCL"}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t("burn.eco")}</TableHead>
                  <TableHead className="text-right">{t("common.tx")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono text-xs tabular">
                {tr.burns.map((b) => (
                  <TableRow key={b.hash}>
                    <TableCell className="text-muted-foreground"><TimeAgo ts={b.time} /> ago</TableCell>
                    <TableCell className="text-right">{fmtUsd(usd(b.usdcSpent))}</TableCell>
                    <TableCell className="text-right text-gold">{fmtNum(Number(b.tokensBurned) / 1e18)}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">{fmtUsd(usd(b.usdcToEco))}</TableCell>
                    <TableCell className="text-right"><a className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" href={txUrl(b.hash)} target="_blank" rel="noreferrer">{shortAddr(b.hash, 6, 4)} <ExternalLink size={10} /></a></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
        {s && <p className="mt-2 text-[11px] text-muted-foreground">{t("explore.stat.fees")} 24h: {fmtUsd(usd(s.fees24hUsdc))}</p>}
      </section>
    </div>
  );
}
