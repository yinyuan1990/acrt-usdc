"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, Globe, Lock, Send, X } from "lucide-react";
import { GRADUATION_THRESHOLD, PLATFORM, SUPPLY, candlesFor, getToken, holdersFor, tradesFor, type Token } from "@/lib/mock";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Addr, Empty, PctChange, TimeAgo, TokenAvatar } from "@/components/shared";
import { PriceChart } from "@/components/token/price-chart";
import { TradePanel } from "@/components/token/trade-panel";
import { GraduationRing } from "@/components/token/graduation-ring";

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const { t } = useApp();
  const token = getToken(address);
  const [sheet, setSheet] = useState(false);

  const candles = useMemo(() => (token ? candlesFor(token) : []), [token]);
  const trades = useMemo(() => (token ? tradesFor(token) : []), [token]);
  const holders = useMemo(() => (token ? holdersFor(token) : []), [token]);

  if (!token) return <Empty>Token not found</Empty>;

  const mcap = token.price * SUPPLY;
  const progress = (token.pairedUsdc / GRADUATION_THRESHOLD) * 100;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="min-w-0 space-y-4">
          {/* Header */}
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-start gap-3">
                <TokenAvatar emoji={token.emoji} hue={token.hue} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold md:text-2xl">{token.name}</h1>
                    <span className="font-mono text-sm text-muted-foreground">${token.symbol}</span>
                    {token.graduated ? <Badge variant="gold">{t("common.graduated")}</Badge> : <Badge variant="accent">{t("common.graduating")}</Badge>}
                    <Badge variant="secondary">
                      <Lock /> {t("token.lpLocked")}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t("common.created")} <TimeAgo ts={token.createdAt} /> ago
                    </span>
                    <span>
                      {t("common.creator")} <Addr value={token.creator} />
                    </span>
                    <span>
                      {t("token.contract")} <Addr value={token.address} />
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-semibold tabular md:text-3xl">{fmtUsd(token.price)}</div>
                  <PctChange value={token.change24h} className="text-sm" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-xs sm:grid-cols-4">
                <Kv label={t("common.mcap")} value={fmtUsd(mcap, { compact: true })} />
                <Kv label={t("common.volume24h")} value={fmtUsd(token.volume24h, { compact: true })} />
                <Kv label={t("common.liquidity")} value={fmtUsd(token.pairedUsdc * 2, { compact: true })} />
                <Kv label={t("common.holders")} value={fmtNum(token.holders)} />
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b px-4 py-2 text-xs">
              <Tabs defaultValue="1m">
                <TabsList variant="line" className="h-7">
                  {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
                    <TabsTrigger key={tf} value={tf} className="px-2 font-mono text-xs">
                      {tf}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <span className="font-mono text-muted-foreground">{token.symbol}/USDC · Uniswap V3 · 1%</span>
            </div>
            <PriceChart candles={candles} className="h-[320px] w-full md:h-[420px]" />
          </Card>

          {/* Tabs */}
          <Card className="gap-0 py-0">
            <Tabs defaultValue="trades">
              <div className="border-b p-2">
                <TabsList>
                  <TabsTrigger value="trades">{t("token.trades")}</TabsTrigger>
                  <TabsTrigger value="holders">{t("token.holders")}</TabsTrigger>
                  <TabsTrigger value="info">{t("token.info")}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="trades">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.time")}</TableHead>
                      <TableHead>{t("common.type")}</TableHead>
                      <TableHead className="text-right">USDC</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">{token.symbol}</TableHead>
                      <TableHead className="hidden text-right md:table-cell">{t("common.price")}</TableHead>
                      <TableHead className="text-right">{t("common.wallet")}</TableHead>
                      <TableHead className="hidden text-right md:table-cell">{t("common.tx")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="font-mono text-xs tabular">
                    {trades.map((tr) => (
                      <TableRow key={tr.hash}>
                        <TableCell className="text-muted-foreground">
                          <TimeAgo ts={tr.time} />
                        </TableCell>
                        <TableCell className={tr.side === "buy" ? "text-up" : "text-down"}>{tr.side === "buy" ? t("common.buy") : t("common.sell")}</TableCell>
                        <TableCell className="text-right">{fmtUsd(tr.usdc)}</TableCell>
                        <TableCell className="hidden text-right sm:table-cell">{fmtNum(tr.tokens)}</TableCell>
                        <TableCell className="hidden text-right md:table-cell">{fmtUsd(tr.price)}</TableCell>
                        <TableCell className="text-right text-secondary-foreground">{shortAddr(tr.wallet, 4, 4)}</TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          <a className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" href="#">
                            {shortAddr(tr.hash, 4, 4)} <ExternalLink size={10} />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="holders">
                <div className="divide-y">
                  {holders.map((h, i) => (
                    <div key={h.wallet} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                      <span className="w-5 font-mono text-muted-foreground">{i + 1}</span>
                      <span className="font-mono">{shortAddr(h.wallet, 6, 4)}</span>
                      {h.label && <Badge variant={h.label.startsWith("Pool") ? "accent" : "gold"}>{h.label}</Badge>}
                      <div className="ml-auto flex items-center gap-3">
                        <Progress value={h.pct} className="hidden w-32 sm:flex" indicatorClassName={h.label ? undefined : "bg-up"} />
                        <span className="w-14 text-right font-mono tabular">{h.pct.toFixed(2)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="info">
                <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
                  <div>
                    <div className="label mb-1">{t("token.about")}</div>
                    <p className="text-secondary-foreground">{token.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {token.socials.website && <SocialLink href={token.socials.website} icon={<Globe />} label="Website" />}
                      {token.socials.twitter && <SocialLink href={token.socials.twitter} icon={<X />} label="X" />}
                      {token.socials.telegram && <SocialLink href={token.socials.telegram} icon={<Send />} label="Telegram" />}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <InfoRow k={t("token.supply")} v={`${fmtNum(SUPPLY)} ${token.symbol}`} />
                    <InfoRow k={t("token.contract")} v={<Addr value={token.address} head={10} tail={6} />} />
                    <InfoRow k={t("token.pool")} v={<Addr value={token.pool} head={10} tail={6} />} />
                    <InfoRow k={t("token.poolFee")} v={`${PLATFORM.poolFee}%`} />
                    <InfoRow k={t("token.creatorFee")} v={`${PLATFORM.creatorShare}%`} />
                    <InfoRow k={t("token.protocolFee")} v={`${PLATFORM.protocolShare}%`} />
                    <InfoRow k={t("token.feesEarned")} v={fmtUsd(token.feesEarned)} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Right column (desktop) */}
        <aside className="hidden space-y-4 xl:block">
          <TradePanel token={token} />
          <GraduationCard progress={progress} token={token} />
        </aside>
      </div>

      {/* Mobile: graduation card + sticky trade bar + bottom sheet */}
      <div className="mt-4 xl:hidden">
        <GraduationCard progress={progress} token={token} />
      </div>
      <div className="safe-bottom fixed inset-x-0 bottom-[60px] z-30 flex gap-2 border-t bg-background/90 p-3 backdrop-blur xl:hidden">
        <Button variant="up" size="xl" className="flex-1" onClick={() => setSheet(true)}>
          {t("common.buy")}
        </Button>
        <Button variant="down" size="xl" className="flex-1" onClick={() => setSheet(true)}>
          {t("common.sell")}
        </Button>
      </div>
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="safe-bottom rounded-t-xl p-4 pt-3" showCloseButton={false}>
          <SheetTitle className="sr-only">
            {t("common.buy")} / {t("common.sell")} {token.symbol}
          </SheetTitle>
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-input" />
          <TradePanel token={token} bare />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular">{v}</span>
    </div>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noreferrer">
        {icon} {label}
      </a>
    </Button>
  );
}

function GraduationCard({ progress, token }: { progress: number; token: Token }) {
  const { t } = useApp();
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center gap-4">
          <GraduationRing progress={progress} graduated={token.graduated} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="label">{t("common.progress")}</div>
            <div className="mt-1 font-mono text-base font-semibold tabular">
              {fmtUsd(token.pairedUsdc, { compact: true })} <span className="text-muted-foreground">/ {fmtUsd(GRADUATION_THRESHOLD, { compact: true })}</span>
            </div>
            <div className="mt-1 text-muted-foreground">
              {token.graduated && token.graduatedAt ? (
                <>
                  {t("token.graduatedAt")} <TimeAgo ts={token.graduatedAt} /> ago
                </>
              ) : (
                <>
                  {t("token.paired")} · {t("token.threshold")} {fmtUsd(GRADUATION_THRESHOLD, { compact: true })}
                </>
              )}
            </div>
          </div>
        </div>
        <div className={cn("mt-3 rounded-lg bg-muted p-3 text-[11px] text-secondary-foreground")}>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("token.creatorFee")}</span>
            <span className="font-mono text-up">{PLATFORM.creatorShare}%</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">{t("token.feesEarned")}</span>
            <span className="font-mono tabular">{fmtUsd(token.feesEarned)}</span>
          </div>
          <div className="mt-2 text-muted-foreground">{t("creator.forever")}</div>
        </div>
        <Button variant="link" size="sm" className="mt-2 w-full" asChild>
          <Link href="/create">{t("create.title")} →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
