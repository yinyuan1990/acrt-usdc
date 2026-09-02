"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, Globe, Lock, Send, X } from "lucide-react";
import { GRADUATION_THRESHOLD, PLATFORM, SUPPLY, candlesFor, getToken, holdersFor, tradesFor, type Token } from "@/lib/mock";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Addr, Badge, Button, Empty, PctChange, Progress, Tabs, TimeAgo, TokenAvatar, cn } from "@/components/ui";
import { PriceChart } from "@/components/token/price-chart";
import { TradePanel } from "@/components/token/trade-panel";
import { GraduationRing } from "@/components/token/graduation-ring";

type Tab = "trades" | "holders" | "info";

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const { t } = useApp();
  const token = getToken(address);
  const [tab, setTab] = useState<Tab>("trades");
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
          <div className="card p-4 md:p-5">
            <div className="flex flex-wrap items-start gap-3">
              <TokenAvatar emoji={token.emoji} hue={token.hue} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold md:text-2xl">{token.name}</h1>
                  <span className="font-mono text-sm text-muted">${token.symbol}</span>
                  {token.graduated ? <Badge tone="gold">{t("common.graduated")}</Badge> : <Badge tone="accent">{t("common.graduating")}</Badge>}
                  <Badge>
                    <Lock size={10} /> {t("token.lpLocked")}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
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

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs sm:grid-cols-4">
              <Kv label={t("common.mcap")} value={fmtUsd(mcap, { compact: true })} />
              <Kv label={t("common.volume24h")} value={fmtUsd(token.volume24h, { compact: true })} />
              <Kv label={t("common.liquidity")} value={fmtUsd(token.pairedUsdc * 2, { compact: true })} />
              <Kv label={t("common.holders")} value={fmtNum(token.holders)} />
            </div>
          </div>

          {/* Chart */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs">
              <div className="flex gap-1">
                {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf, i) => (
                  <button key={tf} className={cn("rounded-xs px-2 py-1 font-mono", i === 0 ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
                    {tf}
                  </button>
                ))}
              </div>
              <span className="font-mono text-muted">{token.symbol}/USDC · Uniswap V3 · 1%</span>
            </div>
            <PriceChart candles={candles} className="h-[320px] w-full md:h-[420px]" />
          </div>

          {/* Tabs */}
          <div className="card">
            <div className="border-b border-line p-2">
              <Tabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: "trades", label: t("token.trades") },
                  { id: "holders", label: t("token.holders") },
                  { id: "info", label: t("token.info") },
                ]}
                className="w-fit"
              />
            </div>

            {tab === "trades" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted">
                    <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                      <th>{t("common.time")}</th>
                      <th>{t("common.type")}</th>
                      <th className="text-right">USDC</th>
                      <th className="hidden text-right sm:table-cell">{token.symbol}</th>
                      <th className="hidden text-right md:table-cell">{t("common.price")}</th>
                      <th className="text-right">{t("common.wallet")}</th>
                      <th className="hidden text-right md:table-cell">{t("common.tx")}</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular">
                    {trades.map((tr) => (
                      <tr key={tr.hash} className="border-t border-line hover:bg-surface-2 [&>td]:px-4 [&>td]:py-2">
                        <td className="text-muted">
                          <TimeAgo ts={tr.time} />
                        </td>
                        <td className={tr.side === "buy" ? "text-up" : "text-down"}>{tr.side === "buy" ? t("common.buy") : t("common.sell")}</td>
                        <td className="text-right">{fmtUsd(tr.usdc)}</td>
                        <td className="hidden text-right sm:table-cell">{fmtNum(tr.tokens)}</td>
                        <td className="hidden text-right md:table-cell">{fmtUsd(tr.price)}</td>
                        <td className="text-right text-fg-2">{shortAddr(tr.wallet, 4, 4)}</td>
                        <td className="hidden text-right md:table-cell">
                          <a className="inline-flex items-center gap-1 text-muted hover:text-fg" href="#">
                            {shortAddr(tr.hash, 4, 4)} <ExternalLink size={10} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "holders" && (
              <div className="divide-y divide-line">
                {holders.map((h, i) => (
                  <div key={h.wallet} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    <span className="w-5 font-mono text-muted">{i + 1}</span>
                    <span className="font-mono">{shortAddr(h.wallet, 6, 4)}</span>
                    {h.label && <Badge tone={h.label.startsWith("Pool") ? "accent" : "gold"}>{h.label}</Badge>}
                    <div className="ml-auto flex items-center gap-3">
                      <div className="hidden w-32 sm:block">
                        <Progress value={h.pct} thin tone={h.label ? "accent" : "up"} />
                      </div>
                      <span className="w-14 text-right font-mono tabular">{h.pct.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "info" && (
              <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
                <div>
                  <div className="label mb-1 text-[11px] text-muted">{t("token.about")}</div>
                  <p className="text-fg-2">{token.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {token.socials.website && <SocialLink href={token.socials.website} icon={<Globe size={12} />} label="Website" />}
                    {token.socials.twitter && <SocialLink href={token.socials.twitter} icon={<X size={12} />} label="X" />}
                    {token.socials.telegram && <SocialLink href={token.socials.telegram} icon={<Send size={12} />} label="Telegram" />}
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
            )}
          </div>
        </div>

        {/* Right column (desktop) */}
        <aside className="hidden space-y-4 xl:block">
          <TradePanel token={token} />
          <GraduationCard progress={progress} token={token} />
        </aside>
      </div>

      {/* Mobile: graduation card + sticky trade bar */}
      <div className="mt-4 xl:hidden">
        <GraduationCard progress={progress} token={token} />
      </div>
      <div className="safe-bottom fixed inset-x-0 bottom-[60px] z-30 flex gap-2 border-t border-line bg-bg/90 p-3 backdrop-blur xl:hidden">
        <Button variant="up" size="lg" className="flex-1" onClick={() => setSheet(true)}>
          {t("common.buy")}
        </Button>
        <Button variant="down" size="lg" className="flex-1" onClick={() => setSheet(true)}>
          {t("common.sell")}
        </Button>
      </div>
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 xl:hidden" onClick={() => setSheet(false)}>
          <div className="sheet-up safe-bottom w-full rounded-t-card bg-bg" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-pill bg-line-strong" />
            <div className="p-3">
              <TradePanel token={token} className="border-0 shadow-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="font-mono tabular">{v}</span>
    </div>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-btn border border-line px-2.5 py-1 text-xs text-fg-2 hover:bg-surface-2">
      {icon} {label}
    </a>
  );
}

function GraduationCard({ progress, token }: { progress: number; token: Token }) {
  const { t } = useApp();
  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <GraduationRing progress={progress} graduated={token.graduated} />
        <div className="min-w-0 flex-1 text-xs">
          <div className="label text-[11px] text-muted">{t("common.progress")}</div>
          <div className="mt-1 font-mono text-base font-semibold tabular">
            {fmtUsd(token.pairedUsdc, { compact: true })} <span className="text-muted">/ {fmtUsd(GRADUATION_THRESHOLD, { compact: true })}</span>
          </div>
          <div className="mt-1 text-muted">
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
      <div className="mt-3 rounded-btn bg-surface-2 p-3 text-[11px] text-fg-2">
        <div className="flex items-center justify-between">
          <span className="text-muted">{t("token.creatorFee")}</span>
          <span className="font-mono text-up">{PLATFORM.creatorShare}%</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-muted">{t("token.feesEarned")}</span>
          <span className="font-mono tabular">{fmtUsd(token.feesEarned)}</span>
        </div>
        <div className="mt-2 text-muted">{t("creator.forever")}</div>
      </div>
      <Link href="/create" className="mt-3 block text-center text-xs text-accent-hi hover:underline">
        {t("create.title")} →
      </Link>
    </div>
  );
}
