"use client";

import Link from "next/link";
import { GraduationCap, Rocket, Zap } from "lucide-react";
import type { Token } from "@/lib/mock";
import { GRADUATION_THRESHOLD, SUPPLY } from "@/lib/mock";
import { fmtNum, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PctChange, TimeAgo, TokenAvatar } from "@/components/shared";

/** Axiom / Photon style three-column live board: New · About to graduate · Graduated. */
export function PulseView({ tokens }: { tokens: Token[] }) {
  const { t } = useApp();
  const fresh = [...tokens].filter((x) => !x.graduated).sort((a, b) => b.createdAt - a.createdAt);
  const climbing = [...tokens].filter((x) => !x.graduated && x.pairedUsdc / GRADUATION_THRESHOLD > 0.3).sort((a, b) => b.pairedUsdc - a.pairedUsdc);
  const graduated = [...tokens].filter((x) => x.graduated).sort((a, b) => b.volume24h - a.volume24h);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Column title={t("explore.pulse.new")} icon={<Zap size={13} />} tone="text-primary" tokens={fresh} />
      <Column title={t("explore.pulse.graduating")} icon={<Rocket size={13} />} tone="text-up" tokens={climbing} />
      <Column title={t("explore.pulse.graduated")} icon={<GraduationCap size={13} />} tone="text-gold" tokens={graduated} />
    </div>
  );
}

function Column({ title, icon, tone, tokens }: { title: string; icon: React.ReactNode; tone: string; tokens: Token[] }) {
  return (
    <Card className="gap-0 py-0">
      <div className={cn("flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold", tone)}>
        {icon} {title}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{tokens.length}</span>
      </div>
      <ScrollArea className="h-[560px]">
        <div className="divide-y">
          {tokens.map((tok) => (
            <Row key={tok.address} token={tok} />
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

function Row({ token }: { token: Token }) {
  const { t } = useApp();
  const progress = Math.min(100, (token.pairedUsdc / GRADUATION_THRESHOLD) * 100);
  return (
    <Link href={`/token/${token.address}`} className="flex gap-2.5 px-3 py-2.5 text-xs hover:bg-accent">
      <TokenAvatar emoji={token.emoji} hue={token.hue} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{token.symbol}</span>
          <span className="truncate text-muted-foreground">{token.name}</span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            <TimeAgo ts={token.createdAt} />
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] tabular">
          <span>
            <span className="text-muted-foreground">MC </span>
            {fmtUsd(token.price * SUPPLY, { compact: true })}
          </span>
          <span>
            <span className="text-muted-foreground">V </span>
            {fmtUsd(token.volume24h, { compact: true })}
          </span>
          <span>
            <span className="text-muted-foreground">H </span>
            {fmtNum(token.holders)}
          </span>
          <PctChange value={token.change24h} className="ml-auto" />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Progress value={token.graduated ? 100 : progress} className="h-1" indicatorClassName={token.graduated ? "bg-gold" : undefined} />
          <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">{token.graduated ? t("common.graduated").slice(0, 3) : `${progress.toFixed(0)}%`}</span>
        </div>
      </div>
    </Link>
  );
}
