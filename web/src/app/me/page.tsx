"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { HOLDINGS, MY_TOKENS, PLATFORM, TOKENS, tradesFor } from "@/lib/mock";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, PctChange, SectionTitle, Stat, TimeAgo, TokenAvatar } from "@/components/shared";

export default function MePage() {
  const { t, connected, toggleConnect } = useApp();

  if (!connected) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">{t("me.title")}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Wallet size={22} />
            </span>
            <p className="text-sm text-secondary-foreground">{t("common.connect")}</p>
            <Button variant="glow" onClick={toggleConnect}>
              {t("common.connect")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const value = HOLDINGS.reduce((s, h) => s + h.tokens * h.token.price, 0);
  const cost = HOLDINGS.reduce((s, h) => s + h.tokens * h.avgCost, 0);
  const pnl = value - cost;
  const history = tradesFor(TOKENS[0], 12);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("me.title")}</h1>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("me.value")} value={fmtUsd(value)} />
        <Stat label={t("me.pnl")} value={`${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}`} tone={pnl >= 0 ? "up" : "down"} sub={<PctChange value={(pnl / cost) * 100} />} />
        <Stat label="USDC" value={fmtUsd(1240.55)} sub={t("common.balance")} />
      </section>

      <section>
        <Tabs defaultValue="held">
          <SectionTitle
            right={
              <TabsList>
                <TabsTrigger value="held">{t("me.held")}</TabsTrigger>
                <TabsTrigger value="created">{t("me.created")}</TabsTrigger>
              </TabsList>
            }
          >
            {t("me.holdings")}
          </SectionTitle>

          <TabsContent value="held">
            {HOLDINGS.length === 0 ? (
              <Empty>{t("me.empty")}</Empty>
            ) : (
              <Card className="gap-0 py-0">
                <div className="divide-y">
                  {HOLDINGS.map((h) => {
                    const v = h.tokens * h.token.price;
                    const p = ((h.token.price - h.avgCost) / h.avgCost) * 100;
                    return (
                      <Link key={h.token.address} href={`/token/${h.token.address}`} className="flex items-center gap-3 p-3 hover:bg-accent">
                        <TokenAvatar emoji={h.token.emoji} hue={h.token.hue} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold">{h.token.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">${h.token.symbol}</span>
                          </div>
                          <div className="font-mono text-xs text-muted-foreground tabular">{fmtNum(h.tokens)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-semibold tabular">{fmtUsd(v)}</div>
                          <PctChange value={p} className="text-xs" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="created">
            <Card className="gap-0 py-0">
              <div className="divide-y">
                {MY_TOKENS.map((tok) => (
                  <Link key={tok.address} href={`/token/${tok.address}`} className="flex items-center gap-3 p-3 hover:bg-accent">
                    <TokenAvatar emoji={tok.emoji} hue={tok.hue} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{tok.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">${tok.symbol}</span>
                        {tok.graduated && <Badge variant="gold">{t("common.graduated")}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("token.feesEarned")} <span className="font-mono text-up tabular">{fmtUsd(tok.feesEarned * (PLATFORM.creatorShare / 100))}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm tabular">{fmtUsd(tok.price)}</div>
                      <PctChange value={tok.change24h} className="text-xs" />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <section>
        <SectionTitle>{t("me.history")}</SectionTitle>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.time")}</TableHead>
                <TableHead>{t("common.type")}</TableHead>
                <TableHead>{t("common.token")}</TableHead>
                <TableHead className="text-right">USDC</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t("common.tx")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs tabular">
              {history.map((tr) => (
                <TableRow key={tr.hash}>
                  <TableCell className="text-muted-foreground">
                    <TimeAgo ts={tr.time} /> ago
                  </TableCell>
                  <TableCell className={tr.side === "buy" ? "text-up" : "text-down"}>{tr.side === "buy" ? t("common.buy") : t("common.sell")}</TableCell>
                  <TableCell>${TOKENS[0].symbol}</TableCell>
                  <TableCell className="text-right">{fmtUsd(tr.usdc)}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{shortAddr(tr.hash, 6, 4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
