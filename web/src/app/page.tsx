"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Crown, Flame } from "lucide-react";
import { GRADUATION_THRESHOLD, PLATFORM_STATS, TOKENS } from "@/lib/mock";
import { fmtNum, fmtUsd } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Button, PctChange, Progress, SectionTitle, Stat, Tabs, TokenAvatar } from "@/components/ui";
import { TokenCard } from "@/components/token/token-card";

type Filter = "trending" | "new" | "graduating" | "graduated";

export default function ExplorePage() {
  const { t } = useApp();
  const [filter, setFilter] = useState<Filter>("trending");

  const king = useMemo(
    () => [...TOKENS].filter((x) => !x.graduated).sort((a, b) => b.pairedUsdc - a.pairedUsdc)[0],
    [],
  );

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
        <div className="card relative overflow-hidden p-5 md:p-7">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-pill bg-accent/20 blur-3xl" />
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-4xl">
            {t("explore.title")}
            <span className="ml-3 align-middle font-mono text-xs font-normal text-accent-hi">Arc · USDC</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-fg-2 md:text-base">{t("explore.subtitle")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/create">
              <Button size="lg">
                {t("nav.create")} <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/burn">
              <Button size="lg" variant="outline">
                <Flame size={16} /> {t("nav.burn")}
              </Button>
            </Link>
          </div>
        </div>

        {/* King of the hill */}
        <Link href={`/token/${king.address}`} className="card group relative overflow-hidden border-gold/40 p-5">
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-pill bg-gold/15 blur-3xl" />
          <div className="mb-3 flex items-center gap-2 text-xs text-gold">
            <Crown size={14} /> <span className="label">{t("explore.king")}</span>
            <span className="text-muted">· {t("explore.kingDesc")}</span>
          </div>
          <div className="flex items-center gap-3">
            <TokenAvatar emoji={king.emoji} hue={king.hue} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-lg font-semibold">{king.name}</div>
                <span className="font-mono text-xs text-muted">${king.symbol}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono tabular">{fmtUsd(king.price)}</span>
                <PctChange value={king.change24h} />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span>{t("common.progress")}</span>
              <span className="font-mono text-fg tabular">
                {fmtUsd(king.pairedUsdc, { compact: true })} / {fmtUsd(GRADUATION_THRESHOLD, { compact: true })}
              </span>
            </div>
            <Progress value={kingProgress} tone="gold" />
          </div>
        </Link>
      </section>

      {/* Platform stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("explore.stat.launched")} value={fmtNum(PLATFORM_STATS.launchedToday)} />
        <Stat label={t("explore.stat.volume")} value={fmtUsd(PLATFORM_STATS.volumeToday, { compact: true })} />
        <Stat label={t("explore.stat.fees")} value={fmtUsd(PLATFORM_STATS.feesToday, { compact: true })} tone="accent" />
        <Stat label={t("explore.stat.burned")} value={fmtUsd(PLATFORM_STATS.totalBurnedUsd, { compact: true })} tone="gold" />
      </section>

      {/* List */}
      <section>
        <SectionTitle
          right={
            <Tabs<Filter>
              value={filter}
              onChange={setFilter}
              tabs={[
                { id: "trending", label: t("common.trending") },
                { id: "new", label: t("common.new") },
                { id: "graduating", label: t("common.graduating") },
                { id: "graduated", label: t("common.graduated") },
              ]}
            />
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
