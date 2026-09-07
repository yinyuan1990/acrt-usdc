"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { progressOf, usd, useCreator, type TokenView } from "@/lib/api";
import { fmtUsd, shortAddr } from "@/lib/format";
import { ADDR, lockerAbi, txUrl } from "@/lib/web3";
import { clockStore } from "@/lib/store";
import { useTx } from "@/lib/tx";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Addr, Countdown, Empty, SectionTitle, Stat, TimeAgo, TokenAvatar } from "@/components/shared";

export default function CreatorPage() {
  const { t, connected, address, toggleConnect } = useApp();
  const { data, isLoading } = useCreator(address);
  const { run } = useTx();
  const qc = useQueryClient();
  const [editFor, setEditFor] = useState<TokenView | null>(null);
  const [newPayout, setNewPayout] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const clock = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);

  if (!connected || !address) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">{t("creator.title")}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary"><Wallet size={22} /></span>
            <p className="text-sm text-secondary-foreground">{t("creator.connectHint")}</p>
            <Button variant="glow" onClick={toggleConnect}>{t("common.connect")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["creator", address] });
  const isPayoutOf = (tok: TokenView) => tok.payout.toLowerCase() === address.toLowerCase();
  const claimable = usd(data?.claimableUsdc);
  const claim = async () => {
    const rc = await run(t("common.claim"), { address: ADDR.locker, abi: lockerAbi, functionName: "claim", args: [ADDR.usdc] });
    if (rc) void refresh();
  };

  const veto = async (tok: TokenView) => {
    setBusy(tok.address);
    try {
      const rc = await run(`${t("creator.takeover.veto")} $${tok.symbol}`, { address: ADDR.locker, abi: lockerAbi, functionName: "cancelPayoutProposal", args: [tok.address as Address] });
      if (rc) void refresh();
    } finally {
      setBusy(null);
    }
  };

  const savePayout = async () => {
    if (!editFor || !isAddress(newPayout)) return;
    setBusy(editFor.address);
    try {
      const rc = await run(`${t("creator.editPayout")} $${editFor.symbol}`, { address: ADDR.locker, abi: lockerAbi, functionName: "setPayout", args: [editFor.address as Address, newPayout as Address] });
      if (rc) {
        setEditFor(null);
        setNewPayout("");
        void refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const proposals = (data?.tokens ?? []).filter((tok) => tok.pendingPayout);
  const nowSec = (clock ?? 0) / 1000;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("creator.title")}</h1>
          <p className="mt-1 text-sm text-secondary-foreground">{t("creator.subtitle")}</p>
        </div>
        <Card size="sm" className="py-2">
          <CardContent className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{t("common.wallet")}</span>
            <Addr value={address} head={8} tail={6} className="text-foreground" />
          </CardContent>
        </Card>
      </div>

      {proposals.length > 0 && (
        <section className="space-y-2">
          {proposals.map((tok) => {
            const pp = tok.pendingPayout!;
            const ready = nowSec > 0 && pp.eta <= nowSec;
            return (
              <Card key={tok.address} className="ring-gold/50">
                <CardContent className="flex flex-wrap items-center gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold"><ShieldAlert size={20} /></span>
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {t("creator.takeover.title")} · <Link href={`/token/${tok.address}`} className="font-mono hover:underline">${tok.symbol}</Link>
                      <Badge variant={ready ? "down" : "gold"}>{ready ? t("creator.takeover.ready") : <>{t("creator.takeover.effectiveIn")} <Countdown eta={pp.eta} /></>}</Badge>
                    </div>
                    <p className="text-xs text-secondary-foreground">{t("creator.takeover.desc")}</p>
                    <div className="text-xs text-muted-foreground">{t("creator.takeover.newPayout")}: <Addr value={pp.newPayout} head={10} tail={8} /></div>
                  </div>
                  {isPayoutOf(tok) && (
                    <Button variant="down" disabled={busy === tok.address} onClick={() => void veto(tok)}>{t("creator.takeover.veto")}</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("creator.totalEarned")} value={data ? fmtUsd(usd(data.earnedUsdc)) : "…"} tone="up" sub={t("creator.forever")} />
        <Stat label={t("creator.pending")} value={data ? fmtUsd(usd(data.pendingEstimateUsdc)) : "…"} sub={t("creator.pendingHint")} />
        <Card size="sm">
          <CardContent className="flex h-full flex-col">
            <div className="label">{t("creator.claimable")}</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular md:text-2xl">{data ? fmtUsd(claimable) : "…"}</div>
            <div className="mt-auto flex items-end justify-between gap-2 pt-2">
              <span className="text-xs text-muted-foreground">{t("creator.claimableHint")}</span>
              <Button size="sm" disabled={claimable === 0} onClick={claim}>{t("common.claim")}</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionTitle>{t("creator.myTokens")}</SectionTitle>
        {isLoading ? null : !data || data.tokens.length === 0 ? (
          <Empty>
            <div className="text-center">
              <div>{t("creator.noTokens")}</div>
              <Button variant="link" asChild><Link href="/create">{t("create.title")} →</Link></Button>
            </div>
          </Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {data.tokens.map((tok) => (
              <Card key={tok.address} size="sm" className="h-full">
                <CardContent className="space-y-3">
                  <Link href={`/token/${tok.address}`} className="flex items-center gap-3">
                    <TokenAvatar logo={tok.logo} symbol={tok.symbol} seed={tok.address} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold hover:underline">{tok.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">${tok.symbol}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground"><TimeAgo ts={tok.launchTs} /> ago · {progressOf(tok).toFixed(0)}%</div>
                    </div>
                    {tok.graduated ? <Badge variant="gold">{t("common.graduated")}</Badge> : <Badge variant="accent">{t("common.graduating")}</Badge>}
                  </Link>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted p-2">
                      <div className="text-muted-foreground">{t("token.feesEarned")}</div>
                      <div className="font-mono font-semibold text-up tabular">{fmtUsd(usd(tok.feesCreatorUsdcTotal))}</div>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <div className="text-muted-foreground">{t("common.volume24h")}</div>
                      <div className="font-mono font-semibold tabular">{fmtUsd(usd(tok.volume24hUsdc), { compact: true })}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-2 py-1.5 text-xs">
                    <span className="text-muted-foreground">{t("creator.payoutAddr")}</span>
                    <span className="flex items-center gap-1">
                      <Addr value={tok.payout} className={isPayoutOf(tok) ? "text-foreground" : "text-gold"} />
                      {isPayoutOf(tok) && (
                        <Button variant="ghost" size="icon-sm" title={t("creator.editPayout")} onClick={() => { setEditFor(tok); setNewPayout(""); }}>
                          <Pencil />
                        </Button>
                      )}
                    </span>
                  </div>
                  {tok.pendingPayout && <Badge variant="gold" className="w-full justify-center"><ShieldAlert /> {t("creator.takeover.title")}</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle right={<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Sparkles size={12} className="text-primary" /> {t("creator.pendingHint")}</span>}>
          {t("creator.payouts")}
        </SectionTitle>
        {!data || data.payouts.length === 0 ? (
          <Empty>{t("common.noData")}</Empty>
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.time")}</TableHead>
                  <TableHead>{t("common.token")}</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                  <TableHead className="text-right">{t("common.status")}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t("common.tx")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {data.payouts.map((p) => (
                  <TableRow key={p.hash + p.token}>
                    <TableCell className="font-mono text-muted-foreground"><TimeAgo ts={p.time} /> ago</TableCell>
                    <TableCell><span className="inline-flex items-center gap-2"><TokenAvatar logo={p.logo} symbol={p.symbol} seed={p.token} size={20} /><span className="font-mono">${p.symbol}</span>{p.kind !== "fee" && <Badge variant="gold" className="px-1.5 py-0 text-[10px]">{t(`tax.kind.${p.kind}`)}</Badge>}</span></TableCell>
                    <TableCell className="text-right font-mono font-semibold text-up tabular">+{fmtUsd(usd(p.usdc))}</TableCell>
                    <TableCell className="text-right">{p.paid ? <Badge variant="up">Paid</Badge> : <Badge variant="gold">{t("creator.claimable")}</Badge>}</TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      <a className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground" href={txUrl(p.hash)} target="_blank" rel="noreferrer">{shortAddr(p.hash, 6, 4)} <ExternalLink size={10} /></a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      <Dialog open={!!editFor} onOpenChange={(o) => !o && setEditFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("creator.editPayout")} · ${editFor?.symbol}</DialogTitle>
            <DialogDescription>{t("creator.editPayoutHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t("admin.ops.current")}: <span className="font-mono">{editFor?.payout}</span></div>
            <Input value={newPayout} onChange={(e) => setNewPayout(e.target.value.trim())} placeholder={`${t("creator.newPayout")} 0x…`} className="font-mono" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditFor(null)}>{t("common.cancel")}</Button>
            <Button disabled={!isAddress(newPayout) || !!busy} onClick={() => void savePayout()}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
