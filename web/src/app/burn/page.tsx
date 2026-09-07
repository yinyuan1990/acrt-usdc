"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ExternalLink, Flame, Lock, Sprout, Timer } from "lucide-react";
import { usd, useStats, useTreasury } from "@/lib/api";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { clockStore } from "@/lib/store";
import { ADDR, addrUrl, txUrl } from "@/lib/web3";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, LiveCountdown, PctChange, SectionTitle, Stat, TimeAgo, TokenAvatar } from "@/components/shared";

const SUPPLY = 1_000_000_000;

/** Two-segment revenue split bar; colours come from the theme (--split-eco / --split-buyback). */
function SplitBar({ eco, buyback }: { eco: number; buyback: number }) {
  return (
    <div className="flex h-7 w-full gap-0.5 overflow-hidden rounded-lg">
      <div className="relative flex items-center justify-center overflow-hidden text-xs font-semibold text-black" style={{ width: `${eco}%`, background: "var(--split-eco)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }}>
        <span className="relative font-mono tabular">{eco}%</span>
      </div>
      <div className="relative flex items-center justify-center overflow-hidden text-xs font-semibold text-white" style={{ width: `${buyback}%`, background: "var(--split-buyback)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }}>
        <span className="relative font-mono tabular">{buyback}%</span>
      </div>
    </div>
  );
}

/** Radial gauge: progress towards the next buyback execution. */
function RingGauge({ value, ready }: { value: number; ready: boolean }) {
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {/* tick marks every 10% */}
        {Array.from({ length: 10 }).map((_, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--background)" strokeWidth={stroke + 2} strokeDasharray={`2 ${c / 10 - 2}`} strokeDashoffset={-(i * c) / 10} opacity={0.9} />
        ))}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ready ? "var(--up)" : "var(--primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="transition-[stroke-dasharray,stroke] duration-700"
          style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${ready ? "var(--up)" : "var(--primary)"} 60%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-mono text-xl font-bold tabular", ready ? "text-up" : "text-foreground")}>{Math.round(value)}%</span>
        <Flame size={12} className={cn(ready ? "text-up" : "text-primary/80")} />
      </div>
    </div>
  );
}

export default function BurnPage() {
  const { t } = useApp();
  const tr = useTreasury().data;
  const s = useStats().data;
  const pending = usd(tr?.pendingRevenueUsdc);
  const reserve = usd(tr?.buybackReserveUsdc);
  const burned = tr ? Number(tr.totalBurned) / 1e18 : 0;
  const pt = tr?.platformToken ?? null;
  const clock = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const nowSec = (clock ?? 0) / 1000;
  const nextAt = tr?.nextExecuteAt ?? 0;
  const interval = tr?.intervalSec ?? 7 * 86400;
  const due = tr ? nowSec >= nextAt : false;
  // progress through the 7-day window
  const cycleProgress = tr && nextAt > 0 && nowSec > 0 ? Math.min(100, Math.max(0, ((nowSec - (nextAt - interval)) / interval) * 100)) : 0;
  const buybackPct = (tr?.buybackBps ?? 2000) / 100;
  const ecoPct = (tr?.ecoBps ?? 8000) / 100;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("burn.title")}</h1>
        <p className="mt-1 text-sm text-secondary-foreground">{t("burn.subtitle")}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("burn.revenue")} value={tr ? fmtUsd(usd(tr.fromCreationFees) + usd(tr.fromTradeFees)) : "…"} sub={tr ? `${t("burn.fromCreation")} ${fmtUsd(usd(tr.fromCreationFees))} · ${t("burn.fromFees")} ${fmtUsd(usd(tr.fromTradeFees))}` : undefined} />
        <Stat label={t("burn.toEco")} value={tr ? fmtUsd(usd(tr.totalToEcoUsdc)) : "…"} tone="primary" sub={tr ? <a className="font-mono hover:underline" href={addrUrl(tr.ecoFund)} target="_blank" rel="noreferrer">{shortAddr(tr.ecoFund, 8, 6)}</a> : undefined} />
        <Stat label={t("burn.boughtBack")} value={tr ? fmtUsd(usd(tr.totalBoughtBackUsdc)) : "…"} tone="burn" sub={tr ? `${t("burn.treasury")} ${fmtUsd(pending)}` : undefined} />
        <Stat label={t("burn.burned")} value={tr ? `${fmtNum(burned)} ${pt?.symbol ?? "ARCL"}` : "…"} tone="burn" sub={tr ? `${((burned / SUPPLY) * 100).toFixed(3)}% · ${fmtUsd(burned * (pt?.price ?? 0))}` : undefined} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="label">{t("burn.nextRun")}</CardTitle>
            <CardAction><span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={t("burn.immutable")}><Timer size={12} /> {t("burn.weekly")} <Lock size={11} /></span></CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <RingGauge value={due ? 100 : cycleProgress} ready={due && (pending > 0 || reserve > 0)} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-muted-foreground">{t("burn.pendingRevenue")}</div>
                <div className="font-mono text-2xl font-bold tabular">{fmtUsd(pending)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {due ? (
                    <span className="text-up">{t("burn.dueNow")}</span>
                  ) : nextAt > 0 ? (
                    <>
                      {t("burn.until")} <LiveCountdown eta={nextAt} className="text-sm font-semibold text-foreground" />
                      <span className="ml-1 font-mono text-[10px]">({new Date(nextAt * 1000).toISOString().slice(5, 16).replace("T", " ")} UTC)</span>
                    </>
                  ) : "—"}
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground"><Sprout size={11} className="mr-1 inline" style={{ color: "var(--split-eco)" }} />{t("burn.eco")} {ecoPct}%</span><span className="font-mono">{tr ? shortAddr(tr.ecoFund, 6, 4) : "…"}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground"><Flame size={11} className="mr-1 inline" style={{ color: "var(--split-buyback)" }} />{t("burn.buyback")} {buybackPct}%</span><span className="font-mono">0x000…dEaD</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("burn.reserve")}</span><span className="font-mono">{fmtUsd(reserve)}</span></div>
                  {reserve > 0 && pt && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{t("burn.nextSlice")}</span>
                      <span className="font-mono">
                        {fmtUsd(usd(tr?.nextBuybackAmountUsdc))}
                        {(tr?.nextBuybackAt ?? 0) > nowSec && <> · <LiveCountdown eta={tr!.nextBuybackAt} /></>}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3"><SplitBar eco={ecoPct} buyback={buybackPct} /></div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t("burn.creationFeeNote")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground"><Lock size={10} className="mr-1 inline" />{t("burn.slicing")}</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
              <a href={addrUrl(ADDR.treasury)} target="_blank" rel="noreferrer"><ExternalLink /> ArcScan</a>
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
        <SectionTitle right={<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><span className="blink size-1.5 rounded-full bg-burn" /> {t("burn.live")}</span>}>{t("burn.history")}</SectionTitle>
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
                    <TableCell className="text-right text-burn">{fmtNum(Number(b.tokensBurned) / 1e18)}</TableCell>
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
