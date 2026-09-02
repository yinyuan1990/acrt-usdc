"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Crown, Flame } from "lucide-react";
import { GRADUATION_THRESHOLD, PLATFORM_STATS, TOKENS } from "@/lib/mock";
import { fmtNum, fmtUsd } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PctChange, SectionTitle, Stat, TokenAvatar } from "@/components/shared";
import { TokenCard } from "@/components/token/token-card";

type Filter = "trending" | "new" | "graduating" | "graduated";

export default function ExplorePage() {
  const { t } = useApp();
  const [filter, setFilter] = useState<Filter>("trending");

  const king = useMemo(() => [...TOKENS].filter((x) => !x.graduated).sort((a, b) => b.pairedUsdc - a.pairedUsdc)[0], []);

  const list = useMemo(() => {
    const xs = [...TOKENS];
    switch (filter) {
      case "new":
        return xs.sort((a, b) => b.createdAt - a.createdAt);
      case "graduating":
        return xs.filter((x) => !x.graduated).sort((a, b) => b.pairedUsdc - a.pairedUsdc);
      case "graduated":
        return xs.filter((x) => x.graduated).sort((a, b) => b.volume24h - a.volume24h);
      default:
        return xs.sort((a, b) => b.volume24h - a.volume24h);
    }
  }, [filter]);

  const kingProgress = (king.pairedUsdc / GRADUATION_THRESHOLD) * 100;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="relative">
          <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/20 blur-3xl" />
          <CardContent className="relative py-2 md:px-7 md:py-4">
            <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
              {t("explore.title")}
              <span className="ml-3 align-middle font-mono text-xs font-normal text-primary">Arc · USDC</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-secondary-foreground md:text-base">{t("explore.subtitle")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="xl" variant="glow" asChild>
                <Link href="/create">
                  {t("nav.create")} <ArrowRight />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/burn">
                  <Flame /> {t("nav.burn")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* King of the hill */}
        <Link href={`/token/${king.address}`} className="block">
          <Card className="relative h-full ring-gold/40 transition-all hover:ring-gold/70">
            <div className="pointer-events-none absolute -bottom-20 -left-16 size-56 rounded-full bg-gold/15 blur-3xl" />
            <CardContent className="relative">
              <div className="mb-3 flex items-center gap-2 text-xs text-gold">
                <Crown size={14} /> <span className="label text-gold!">{t("explore.king")}</span>
                <span className="text-muted-foreground">· {t("explore.kingDesc")}</span>
              </div>
              <div className="flex items-center gap-3">
                <TokenAvatar emoji={king.emoji} hue={king.hue} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-lg font-semibold">{king.name}</div>
                    <span className="font-mono text-xs text-muted-foreground">${king.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono tabular">{fmtUsd(king.price)}</span>
                    <PctChange value={king.change24h} />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
                  <span>{t("common.progress")}</span>
                  <span className="font-mono text-foreground tabular">
                    {fmtUsd(king.pairedUsdc, { compact: true })} / {fmtUsd(GRADUATION_THRESHOLD, { compact: true })}
                  </span>
                </div>
                <Progress value={kingProgress} className="h-2.5" indicatorClassName="bg-gold" shimmer />
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Platform stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("explore.stat.launched")} value={fmtNum(PLATFORM_STATS.launchedToday)} />
        <Stat label={t("explore.stat.volume")} value={fmtUsd(PLATFORM_STATS.volumeToday, { compact: true })} />
        <Stat label={t("explore.stat.fees")} value={fmtUsd(PLATFORM_STATS.feesToday, { compact: true })} tone="primary" />
        <Stat label={t("explore.stat.burned")} value={fmtUsd(PLATFORM_STATS.totalBurnedUsd, { compact: true })} tone="gold" />
      </section>

      {/* List */}
      <section>
        <SectionTitle
          right={
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                <TabsTrigger value="trending">{t("common.trending")}</TabsTrigger>
                <TabsTrigger value="new">{t("common.new")}</TabsTrigger>
                <TabsTrigger value="graduating">{t("common.graduating")}</TabsTrigger>
                <TabsTrigger value="graduated">{t("common.graduated")}</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          {t("common.token")}
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((tok) => (
            <TokenCard key={tok.address} token={tok} />
          ))}
        </div>
      </section>
    </div>
  );
}
