"use client";

import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";
import type { Token } from "@/lib/mock";
import { GRADUATION_THRESHOLD, SUPPLY } from "@/lib/mock";
import { fmtUsd, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PctChange, TimeAgo, TokenAvatar } from "@/components/shared";

export function TokenCard({ token }: { token: Token }) {
  const { t } = useApp();
  const progress = Math.min(100, (token.pairedUsdc / GRADUATION_THRESHOLD) * 100);
  const mcap = token.price * SUPPLY;

  return (
    <Link href={`/token/${token.address}`} className="fade-up block">
      <Card size="sm" className={cn("h-full transition-all hover:-translate-y-0.5 hover:ring-foreground/20", token.graduated && "ring-gold/40")}>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <TokenAvatar emoji={token.emoji} hue={token.hue} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold">{token.name}</h3>
                <span className="font-mono text-xs text-muted-foreground">${token.symbol}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-secondary-foreground">{token.description}</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-semibold tabular">{fmtUsd(token.price)}</div>
              <PctChange value={token.change24h} className="text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div>
              <div>{t("common.mcap")}</div>
              <div className="font-mono text-xs text-foreground tabular">{fmtUsd(mcap, { compact: true })}</div>
            </div>
            <div>
              <div>{t("common.volume24h")}</div>
              <div className="font-mono text-xs text-foreground tabular">{fmtUsd(token.volume24h, { compact: true })}</div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1">
                <Users size={11} /> {t("common.holders")}
              </div>
              <div className="font-mono text-xs text-foreground tabular">{fmtNum(token.holders)}</div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              {token.graduated ? (
                <Badge variant="gold">
                  <GraduationCap /> {t("common.graduated")}
                </Badge>
              ) : (
                <span>
                  {t("common.progress")} <span className="font-mono text-foreground tabular">{progress.toFixed(0)}%</span>
                </span>
              )}
              <TimeAgo ts={token.createdAt} />
            </div>
            <Progress value={token.graduated ? 100 : progress} indicatorClassName={token.graduated ? "bg-gold" : undefined} shimmer={!token.graduated} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
