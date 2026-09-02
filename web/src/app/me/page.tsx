"use client";

import Link from "next/link";
import { ExternalLink, Wallet } from "lucide-react";
import { progressOf, usd, useCreator, useWallet } from "@/lib/api";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { txUrl } from "@/lib/web3";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, PctChange, SectionTitle, Stat, TimeAgo, TokenAvatar } from "@/components/shared";

export default function MePage() {
  const { t, connected, address, toggleConnect } = useApp();
  const { data } = useWallet(address);
  const { data: creator } = useCreator(address);

  if (!connected || !address) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">{t("me.title")}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary"><Wallet size={22} /></span>
            <p className="text-sm text-secondary-foreground">{t("common.connect")}</p>
            <Button variant="glow" onClick={toggleConnect}>{t("common.connect")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const holdings = data?.holdings ?? [];
  const value = holdings.reduce((s, h) => s + h.valueUsd, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("me.title")}</h1>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("me.value")} value={data ? fmtUsd(value) : "…"} />
        <Stat label="USDC" value={data ? fmtUsd(usd(data.usdcBalance)) : "…"} sub={t("common.balance")} />
        <Stat label={t("creator.totalEarned")} value={creator ? fmtUsd(usd(creator.earnedUsdc)) : "…"} tone="up" sub={<Link href="/creator" className="hover:underline">{t("nav.creator")} →</Link>} />
      </section>

      <section>
        <Tabs defaultValue="held">
          <SectionTitle right={<TabsList><TabsTrigger value="held">{t("me.held")}</TabsTrigger><TabsTrigger value="created">{t("me.created")}</TabsTrigger></TabsList>}>
            {t("me.holdings")}
          </SectionTitle>

          <TabsContent value="held">
            {holdings.length === 0 ? (
              <Empty>{t("me.empty")}</Empty>
            ) : (
              <Card className="gap-0 py-0">
                <div className="divide-y">
                  {holdings.map((h) => (
                    <Link key={h.token.address} href={`/token/${h.token.address}`} className="flex items-center gap-3 p-3 hover:bg-accent">
                      <TokenAvatar logo={h.token.logo} symbol={h.token.symbol} seed={h.token.address} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="truncate font-semibold">{h.token.name}</span><span className="font-mono text-xs text-muted-foreground">${h.token.symbol}</span></div>
                        <div className="font-mono text-xs text-muted-foreground tabular">{fmtNum(Number(h.balance) / 1e18)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold tabular">{fmtUsd(h.valueUsd)}</div>
                        <PctChange value={h.token.change24h} className="text-xs" />
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="created">
            {!creator || creator.tokens.length === 0 ? (
              <Empty>{t("creator.noTokens")}</Empty>
            ) : (
              <Card className="gap-0 py-0">
                <div className="divide-y">
                  {creator.tokens.map((tok) => (
                    <Link key={tok.address} href={`/token/${tok.address}`} className="flex items-center gap-3 p-3 hover:bg-accent">
                      <TokenAvatar logo={tok.logo} symbol={tok.symbol} seed={tok.address} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{tok.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">${tok.symbol}</span>
                          {tok.graduated && <Badge variant="gold">{t("common.graduated")}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{t("token.feesEarned")} <span className="font-mono text-up tabular">{fmtUsd(usd(tok.feesCreatorUsdcTotal))}</span> · {progressOf(tok).toFixed(0)}%</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm tabular">{fmtUsd(tok.price)}</div>
                        <PctChange value={tok.change24h} className="text-xs" />
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <section>
        <SectionTitle>{t("me.history")}</SectionTitle>
        {!data || data.trades.length === 0 ? (
          <Empty>{t("common.noData")}</Empty>
        ) : (
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
                {data.trades.map((tr) => (
                  <TableRow key={tr.hash + tr.time}>
                    <TableCell className="text-muted-foreground"><TimeAgo ts={tr.time} /> ago</TableCell>
                    <TableCell className={tr.side === "buy" ? "text-up" : "text-down"}>{tr.side === "buy" ? t("common.buy") : t("common.sell")}</TableCell>
                    <TableCell><Link href={`/token/${tr.token}`} className="hover:underline">${tr.symbol}</Link></TableCell>
                    <TableCell className="text-right">{fmtUsd(usd(tr.usdc))}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <a className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" href={txUrl(tr.hash)} target="_blank" rel="noreferrer">{shortAddr(tr.hash, 6, 4)} <ExternalLink size={10} /></a>
                    </TableCell>
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
