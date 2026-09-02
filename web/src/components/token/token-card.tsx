"use client";

import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";
import type { Token } from "@/lib/mock";
import { GRADUATION_THRESHOLD } from "@/lib/mock";
import { fmtUsd, fmtNum } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Badge, PctChange, Progress, TimeAgo, TokenAvatar, cn } from "@/components/ui";

export function TokenCard({ token, featured }: { token: Token; featured?: boolean }) {
  const { t } = useApp();
  const progress = Math.min(100, (token.pairedUsdc / GRADUATION_THRESHOLD) * 100);
  const mcap = token.price * 1_000_000_000;

  return (
    <Link
      href={`/token/${token.address}`}
      className={cn(
        "card fade-up group block p-4 transition-all hover:-translate-y-0.5 hover:border-line-strong",
        featured && "border-gold/40 bg-gradient-to-br from-gold-soft to-surface",
      )}
    >
      <div className="flex items-start gap-3">
        <TokenAvatar emoji={token.emoji} hue={token.hue} size={featured ? 56 : 44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{token.name}</h3>
            <span className="font-mono text-xs text-muted">${token.symbol}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-fg-2">{token.description}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold tabular">{fmtUsd(token.price)}</div>
          <PctChange value={token.change24h} className="text-xs" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted">
        <div>
          <div>{t("common.mcap")}</div>
          <div className="font-mono text-xs text-fg tabular">{fmtUsd(mcap, { compact: true })}</div>
        </div>
        <div>
          <div>{t("common.volume24h")}</div>
          <div className="font-mono text-xs text-fg tabular">{fmtUsd(token.volume24h, { compact: true })}</div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-1">
            <Users size={11} /> {t("common.holders")}
          </div>
          <div className="font-mono text-xs text-fg tabular">{fmtNum(token.holders)}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-muted">
            {token.graduated ? (
              <Badge tone="gold">
                <GraduationCap size={11} /> {t("common.graduated")}
              </Badge>
            ) : (
              <>
                {t("common.progress")} <span className="font-mono text-fg tabular">{progress.toFixed(0)}%</span>
              </>
            )}
          </span>
          <span className="text-muted">
            <TimeAgo ts={token.createdAt} />
          </span>
        </div>
        <Progress value={token.graduated ? 100 : progress} tone={token.graduated ? "gold" : "accent"} thin />
      </div>
    </Link>
  );
}
