"use client";

import Link from "next/link";
import { ExternalLink, Pencil, Sparkles } from "lucide-react";
import { MY_ADDRESS, MY_TOKENS, PAYOUTS, PLATFORM } from "@/lib/mock";
import { fmtUsd, shortAddr } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Addr, Badge, Button, SectionTitle, Stat, TimeAgo, TokenAvatar } from "@/components/ui";

export default function CreatorPage() {
  const { t } = useApp();
  const paid = PAYOUTS.filter((p) => p.status === "paid").reduce((s, p) => s + p.usdc, 0);
  const claimable = PAYOUTS.filter((p) => p.status === "claimable").reduce((s, p) => s + p.usdc, 0);
  const pending = 31.42;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{t("creator.title")}</h1>
          <p className="mt-1 text-sm text-fg-2">{t("creator.subtitle")}</p>
        </div>
        <div className="card flex items-center gap-3 px-3 py-2 text-xs">
          <span className="text-muted">{t("creator.payoutAddr")}</span>
          <Addr value={MY_ADDRESS} head={8} tail={6} className="text-fg" />
          <button className="inline-flex items-center gap-1 text-accent-hi hover:underline">
            <Pencil size={11} /> {t("creator.edit")}
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("creator.totalEarned")} value={fmtUsd(paid)} tone="up" sub={t("creator.forever")} />
        <Stat label={t("creator.pending")} value={fmtUsd(pending)} sub={t("creator.pendingHint")} />
        <div className="card flex flex-col p-4">
          <div className="label text-[11px] text-muted">{t("creator.claimable")}</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular md:text-2xl">{fmtUsd(claimable)}</div>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <span className="text-xs text-muted">{t("creator.claimableHint")}</span>
            <Button size="sm" disabled={claimable === 0}>
              {t("common.claim")}
            </Button>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>{t("creator.myTokens")}</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {MY_TOKENS.map((tok) => (
            <Link key={tok.address} href={`/token/${tok.address}`} className="card p-4 transition-all hover:-translate-y-0.5 hover:border-line-strong">
              <div className="flex items-center gap-3">
                <TokenAvatar emoji={tok.emoji} hue={tok.hue} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{tok.name}</span>
                    <span className="font-mono text-xs text-muted">${tok.symbol}</span>
                  </div>
                  <div className="text-[11px] text-muted">
                    <TimeAgo ts={tok.createdAt} /> ago
                  </div>
                </div>
                {tok.graduated ? <Badge tone="gold">{t("common.graduated")}</Badge> : <Badge tone="accent">{t("common.graduating")}</Badge>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-btn bg-surface-2 p-2">
                  <div className="text-muted">{t("token.feesEarned")}</div>
                  <div className="font-mono font-semibold text-up tabular">{fmtUsd(tok.feesEarned * (PLATFORM.creatorShare / 100))}</div>
                </div>
                <div className="rounded-btn bg-surface-2 p-2">
                  <div className="text-muted">{t("common.volume24h")}</div>
                  <div className="font-mono font-semibold tabular">{fmtUsd(tok.volume24h, { compact: true })}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          right={
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Sparkles size={12} className="text-accent" /> {t("creator.pendingHint")}
            </span>
          }
        >
          {t("creator.payouts")}
        </SectionTitle>
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-normal">
                <th>{t("common.time")}</th>
                <th>{t("common.token")}</th>
                <th className="text-right">{t("common.amount")}</th>
                <th className="text-right">{t("common.status")}</th>
                <th className="hidden text-right md:table-cell">{t("common.tx")}</th>
              </tr>
            </thead>
            <tbody>
              {PAYOUTS.map((p) => (
                <tr key={p.hash} className="border-t border-line hover:bg-surface-2 [&>td]:px-4 [&>td]:py-2.5">
                  <td className="font-mono text-muted">
                    <TimeAgo ts={p.time} /> ago
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <TokenAvatar emoji={p.token.emoji} hue={p.token.hue} size={20} />
                      <span className="font-mono">${p.token.symbol}</span>
                    </span>
                  </td>
                  <td className="text-right font-mono font-semibold text-up tabular">+{fmtUsd(p.usdc)}</td>
                  <td className="text-right">
                    {p.status === "paid" ? <Badge tone="up">Paid</Badge> : <Badge tone="gold">{t("creator.claimable")}</Badge>}
                  </td>
                  <td className="hidden text-right md:table-cell">
                    <a className="inline-flex items-center gap-1 font-mono text-muted hover:text-fg" href="#">
                      {shortAddr(p.hash, 6, 4)} <ExternalLink size={10} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
