"use client";

import { ExternalLink } from "lucide-react";
import { usd, type AdminOverview } from "@/lib/api";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { txUrl } from "@/lib/web3";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, SectionTitle, Stat, TimeAgo } from "@/components/shared";

export function DataPanel({ ov }: { ov: AdminOverview }) {
  const { t } = useApp();
  const T = ov.totals;
  const n = (k: keyof typeof T) => Number(T[k] ?? 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("admin.kpi.tokens")} value={fmtNum(n("tokens"))} sub={`${t("admin.kpi.graduated")} ${n("graduated")} · 24h +${n("launched_24h")}`} tone="primary" />
        <Stat label={t("admin.kpi.volume")} value={fmtUsd(usd(T.volume_total), { compact: true })} sub={`24h ${fmtUsd(usd(T.volume_24h))} · ${t("admin.kpi.trades")} ${fmtNum(n("trades_total"))}`} />
        <Stat label={t("admin.kpi.fees")} value={fmtUsd(usd(T.fees_total))} sub={`${t("admin.kpi.creatorFees")} ${fmtUsd(usd(T.fees_creator))} · ${t("admin.kpi.protocolFees")} ${fmtUsd(usd(T.fees_protocol))}`} tone="up" />
        <Stat label={t("admin.kpi.treasury")} value={fmtUsd(usd(ov.params.treasury.usdcBalance))} sub={`${t("admin.kpi.creationFees")} ${fmtUsd(usd(T.creation_fees))}`} tone="gold" />
        <Stat label={t("admin.kpi.buyback")} value={fmtUsd(usd(T.buyback_usdc))} sub={`${t("burn.toEco")} ${fmtUsd(usd(T.to_eco))}`} tone="gold" />
        <Stat label={t("admin.kpi.burned")} value={`${fmtNum(Number(T.burned) / 1e18)} ARCL`} tone="gold" />
        <Stat label={t("admin.kpi.traders")} value={fmtNum(n("traders"))} sub={`${t("admin.kpi.holders")} ${fmtNum(n("holders"))}`} />
        <Stat label={t("admin.kpi.fromToken")} value={fmtUsd(usd(T.fees_from_token))} sub={`${t("admin.kpi.parked")} ${n("payouts_parked")}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Bars title={t("admin.daily.launches")} data={ov.daily.map((d) => ({ day: d.day, v: d.launches }))} fmt={(v) => String(v)} color="bg-primary" />
        <Bars title={t("admin.daily.volume")} data={ov.daily.map((d) => ({ day: d.day, v: usd(d.volume) }))} fmt={(v) => fmtUsd(v, { compact: true })} color="bg-up" />
        <Bars title={t("admin.daily.fees")} data={ov.daily.map((d) => ({ day: d.day, v: usd(d.fees) + usd(d.creationFees) }))} fmt={(v) => fmtUsd(v)} color="bg-gold" />
      </section>

      <section>
        <SectionTitle>{t("admin.feeEvents")}</SectionTitle>
        {ov.feeEvents.length === 0 ? (
          <Empty>{t("common.noData")}</Empty>
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.time")}</TableHead>
                  <TableHead>{t("admin.col.token")}</TableHead>
                  <TableHead className="text-right">{t("admin.kpi.creatorFees")}</TableHead>
                  <TableHead className="text-right">{t("admin.kpi.protocolFees")}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t("admin.kpi.fromToken")}</TableHead>
                  <TableHead className="text-right">{t("common.status")}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t("common.tx")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono text-xs tabular">
                {ov.feeEvents.map((f) => (
                  <TableRow key={f.hash + f.token}>
                    <TableCell className="text-muted-foreground"><TimeAgo ts={f.time} /> ago</TableCell>
                    <TableCell>${f.symbol} <span className="text-muted-foreground">{shortAddr(f.payout, 4, 4)}</span></TableCell>
                    <TableCell className="text-right text-up">{fmtUsd(usd(f.quoteCreator))}</TableCell>
                    <TableCell className="text-right">{fmtUsd(usd(f.quoteProtocol))}</TableCell>
                    <TableCell className="hidden text-right md:table-cell">{Number(f.usdcFromToken) > 0 ? fmtUsd(usd(f.usdcFromToken)) : "—"}</TableCell>
                    <TableCell className="text-right">{f.creatorPaid ? <Badge variant="up">Paid</Badge> : <Badge variant="gold">{t("creator.claimable")}</Badge>}</TableCell>
                    <TableCell className="hidden text-right md:table-cell"><a className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" href={txUrl(f.hash)} target="_blank" rel="noreferrer">{shortAddr(f.hash, 6, 4)} <ExternalLink size={10} /></a></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}

/** Tiny dependency-free 30-day bar chart. */
function Bars({ title, data, fmt, color }: { title: string; data: { day: string; v: number }[]; fmt: (v: number) => string; color: string }) {
  const max = Math.max(1e-9, ...data.map((d) => d.v));
  const total = data.reduce((a, d) => a + d.v, 0);
  const { t } = useApp();
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="label">{title} · {t("admin.daily")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-2 font-mono text-xl font-semibold tabular">{fmt(total)}</div>
        <div className="flex h-20 items-end gap-[3px]">
          {data.map((d) => (
            <div key={d.day} className="group relative flex-1">
              <div className={`${color} w-full rounded-t-sm opacity-80 transition-opacity group-hover:opacity-100`} style={{ height: `${Math.max(2, (d.v / max) * 80)}px` }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-popover px-2 py-1 font-mono text-[10px] whitespace-nowrap shadow group-hover:block">
                {d.day.slice(5)} · {fmt(d.v)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{data[0]?.day.slice(5)}</span>
          <span>{data[data.length - 1]?.day.slice(5)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
