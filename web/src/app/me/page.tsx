"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { HOLDINGS, TOKENS, tradesFor } from "@/lib/mock";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Button, Empty, PctChange, SectionTitle, Stat, TimeAgo, TokenAvatar } from "@/components/ui";

export default function MePage() {
  const { t, connected, toggleConnect } = useApp();

  if (!connected) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 font-display text-2xl font-bold tracking-tight md:text-3xl">{t("me.title")}</h1>
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-accent-soft text-accent-hi">
            <Wallet size={22} />
          </span>
          <p className="text-sm text-fg-2">{t("common.connect")}</p>
          <Button onClick={toggleConnect}>{t("common.connect")}</Button>
        </div>
      </div>
    );
  }

  const value = HOLDINGS.reduce((s, h) => s + h.tokens * h.token.price, 0);
  const cost = HOLDINGS.reduce((s, h) => s + h.tokens * h.avgCost, 0);
  const pnl = value - cost;
  const history = tradesFor(TOKENS[0], 12);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{t("me.title")}</h1>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("me.value")} value={fmtUsd(value)} />
        <Stat label={t("me.pnl")} value={`${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}`} tone={pnl >= 0 ? "up" : "down"} sub={<PctChange value={(pnl / cost) * 100} />} />
        <Stat label="USDC" value={fmtUsd(1240.55)} sub={t("common.balance")} />
      </section>

      <section>
        <SectionTitle>{t("me.holdings")}</SectionTitle>
        {HOLDINGS.length === 0 ? (
          <Empty>{t("me.empty")}</Empty>
        ) : (
          <div className="card divide-y divide-line">
            {HOLDINGS.map((h) => {
              const v = h.tokens * h.token.price;
              const p = ((h.token.price - h.avgCost) / h.avgCost) * 100;
              return (
                <Link key={h.token.address} href={`/token/${h.token.address}`} className="flex items-center gap-3 p-3 hover:bg-surface-2">
                  <TokenAvatar emoji={h.token.emoji} hue={h.token.hue} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{h.token.name}</span>
                      <span className="font-mono text-xs text-muted">${h.token.symbol}</span>
                    </div>
                    <div className="font-mono text-xs text-muted tabular">{fmtNum(h.tokens)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold tabular">{fmtUsd(v)}</div>
                    <PctChange value={p} className="text-xs" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>{t("me.history")}</SectionTitle>
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-normal">
                <th>{t("common.time")}</th>
                <th>{t("common.type")}</th>
                <th>{t("common.token")}</th>
                <th className="text-right">USDC</th>
                <th className="hidden text-right sm:table-cell">{t("common.tx")}</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {history.map((tr) => (
                <tr key={tr.hash} className="border-t border-line hover:bg-surface-2 [&>td]:px-4 [&>td]:py-2.5">
                  <td className="text-muted">
                    <TimeAgo ts={tr.time} /> ago
                  </td>
                  <td className={tr.side === "buy" ? "text-up" : "text-down"}>{tr.side === "buy" ? t("common.buy") : t("common.sell")}</td>
                  <td>${TOKENS[0].symbol}</td>
                  <td className="text-right">{fmtUsd(tr.usdc)}</td>
                  <td className="hidden text-right text-muted sm:table-cell">{shortAddr(tr.hash, 6, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
