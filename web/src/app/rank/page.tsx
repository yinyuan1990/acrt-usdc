"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PLATFORM, SUPPLY, TOKENS } from "@/lib/mock";
import { fmtNum, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PctChange, TokenAvatar } from "@/components/shared";

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
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("rank.title")}</h1>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList>
            <TabsTrigger value="volume">{t("rank.byVolume")}</TabsTrigger>
            <TabsTrigger value="gain">{t("rank.byGain")}</TabsTrigger>
            <TabsTrigger value="holders">{t("rank.byHolders")}</TabsTrigger>
            <TabsTrigger value="creator">{t("rank.byCreator")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Desktop table */}
      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>{t("common.token")}</TableHead>
              <TableHead className="text-right">{t("common.price")}</TableHead>
              <TableHead className="text-right">{t("common.change24h")}</TableHead>
              <TableHead className="text-right">{t("common.mcap")}</TableHead>
              <TableHead className="text-right">{t("common.volume24h")}</TableHead>
              <TableHead className="text-right">{t("common.holders")}</TableHead>
              <TableHead className="text-right">{t("rank.byCreator")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((tok, i) => (
              <TableRow key={tok.address}>
                <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Link href={`/token/${tok.address}`} className="flex items-center gap-3">
                    <TokenAvatar emoji={tok.emoji} hue={tok.hue} size={32} />
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        {tok.name}
                        {tok.graduated && <Badge variant="gold">{t("common.graduated")}</Badge>}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">${tok.symbol}</div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono tabular">{fmtUsd(tok.price)}</TableCell>
                <TableCell className="text-right">
                  <PctChange value={tok.change24h} />
                </TableCell>
                <TableCell className="text-right font-mono tabular">{fmtUsd(tok.price * SUPPLY, { compact: true })}</TableCell>
                <TableCell className="text-right font-mono tabular">{fmtUsd(tok.volume24h, { compact: true })}</TableCell>
                <TableCell className="text-right font-mono tabular">{fmtNum(tok.holders)}</TableCell>
                <TableCell className="text-right font-mono text-up tabular">{fmtUsd(tok.feesEarned * (PLATFORM.creatorShare / 100))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((tok, i) => (
          <Link key={tok.address} href={`/token/${tok.address}`} className="block">
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <span className={cn("w-5 font-mono text-sm", i < 3 ? "text-gold" : "text-muted-foreground")}>{i + 1}</span>
                <TokenAvatar emoji={tok.emoji} hue={tok.hue} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{tok.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">${tok.symbol}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
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
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
