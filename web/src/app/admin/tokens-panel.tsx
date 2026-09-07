"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { usd, type AdminOverview, type AdminToken } from "@/lib/api";
import { fmtNum, fmtUsd, shortAddr } from "@/lib/format";
import { ADDR, factoryAbi, lockerAbi } from "@/lib/web3";
import { clockStore } from "@/lib/store";
import { useTx } from "@/lib/tx";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Addr, Countdown, Empty, TimeAgo, TokenAvatar } from "@/components/shared";

export function TokensPanel({ ov, canAct }: { ov: AdminOverview; canAct: boolean }) {
  const { t } = useApp();
  const { run, client } = useTx();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [proposeFor, setProposeFor] = useState<AdminToken | null>(null);
  const [newPayout, setNewPayout] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const distribute = async (tok: AdminToken) => {
    setBusy(tok.address + ":d");
    try {
      // same guard as the keeper: dry-run to learn the conversion output, demand 97% of it
      let minOut = 0n;
      try {
        const sim = await client!.simulateContract({ address: ADDR.locker, abi: lockerAbi, functionName: "distribute", args: [tok.address as Address, 0n] });
        minOut = (sim.result[1] * 97n) / 100n;
      } catch {}
      await run(`${t("admin.act.distribute")} $${tok.symbol}`, { address: ADDR.locker, abi: lockerAbi, functionName: "distribute", args: [tok.address as Address, minOut] });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const graduate = async (tok: AdminToken) => {
    setBusy(tok.address + ":g");
    try {
      await run(`${t("admin.act.graduate")} $${tok.symbol}`, { address: ADDR.factory, abi: factoryAbi, functionName: "markGraduated", args: [tok.address as Address] });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const takeover = async (fn: "executePayout" | "cancelPayoutProposal", tok: AdminToken) => {
    setBusy(tok.address + ":t");
    try {
      await run(`${fn === "executePayout" ? t("admin.act.execute") : t("admin.act.cancel")} $${tok.symbol}`, { address: ADDR.locker, abi: lockerAbi, functionName: fn, args: [tok.address as Address] });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const propose = async () => {
    if (!proposeFor || !isAddress(newPayout)) return;
    setBusy(proposeFor.address + ":p");
    try {
      const ok = await run(`${t("admin.act.propose")} $${proposeFor.symbol}`, { address: ADDR.locker, abi: lockerAbi, functionName: "proposePayout", args: [proposeFor.address as Address, newPayout as Address] });
      if (ok) {
        setProposeFor(null);
        setNewPayout("");
        refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const clock = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const now = (clock ?? 0) / 1000;

  if (ov.tokens.length === 0) return <Empty>{t("common.noData")}</Empty>;
  return (
    <>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.col.token")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("admin.col.creator")}</TableHead>
              <TableHead className="text-right">{t("admin.col.mcap")}</TableHead>
              <TableHead className="hidden text-right md:table-cell">{t("admin.col.vol24")}</TableHead>
              <TableHead className="text-right">{t("admin.col.fees")}</TableHead>
              <TableHead className="hidden text-right xl:table-cell">{t("admin.col.pending")}</TableHead>
              <TableHead className="hidden text-right xl:table-cell">{t("admin.col.backlog")}</TableHead>
              <TableHead className="hidden text-right lg:table-cell">{t("admin.col.claimable")}</TableHead>
              <TableHead className="hidden text-right md:table-cell">{t("admin.col.lastDist")}</TableHead>
              <TableHead>{t("admin.col.status")}</TableHead>
              {canAct && <TableHead className="text-right">{t("admin.col.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {ov.tokens.map((tok) => {
              const paired = usd(tok.pairedUsdc);
              const thr = usd(tok.graduationThreshold) || 1;
              const canGraduate = !tok.graduated && paired >= thr;
              const pp = tok.pendingPayout;
              const ready = !!pp && pp.eta <= now;
              const isBusy = busy?.startsWith(tok.address) ?? false;
              return (
                <TableRow key={tok.address}>
                  <TableCell>
                    <Link href={`/token/${tok.address}`} className="inline-flex items-center gap-2 hover:underline">
                      <TokenAvatar logo={tok.logo} symbol={tok.symbol} seed={tok.address} size={22} className="rounded-md" />
                      <span className="font-mono font-semibold">${tok.symbol}</span>
                    </Link>
                    <div className="text-[10px] text-muted-foreground"><TimeAgo ts={tok.launchTs} /> ago · {shortAddr(tok.address, 6, 4)}</div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div><Addr value={tok.deployer} /></div>
                    {tok.payout.toLowerCase() !== tok.deployer.toLowerCase() && <div className="text-[10px] text-gold">→ <Addr value={tok.payout} /></div>}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">{fmtUsd(tok.mcapUsd, { compact: true })}</TableCell>
                  <TableCell className="hidden text-right font-mono tabular md:table-cell">{fmtUsd(usd(tok.volume24hUsdc), { compact: true })}</TableCell>
                  <TableCell className="text-right font-mono tabular">{fmtUsd(usd(tok.feesUsdcTotal))} <span className="text-muted-foreground">({fmtUsd(usd(tok.feesCreatorUsdcTotal))})</span></TableCell>
                  <TableCell className="hidden text-right font-mono tabular xl:table-cell">{fmtUsd(usd(tok.volumeSinceDistribute) / 100)}</TableCell>
                  <TableCell className="hidden text-right font-mono tabular xl:table-cell">{Number(tok.unconvertedTokenFees) > 0 ? <span className="text-gold">{fmtNum(Number(tok.unconvertedTokenFees) / 1e18)}</span> : "—"}</TableCell>
                  <TableCell className="hidden text-right font-mono tabular lg:table-cell">{Number(tok.claimableUsdc) > 0 ? <span className="text-gold">{fmtUsd(usd(tok.claimableUsdc))}</span> : "—"}</TableCell>
                  <TableCell className="hidden text-right font-mono text-muted-foreground md:table-cell">{tok.lastDistributedAt ? <><TimeAgo ts={tok.lastDistributedAt} /> ago</> : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tok.graduated ? <Badge variant="gold">{t("common.graduated")}</Badge> : <Badge variant="secondary">{Math.min(100, Math.round((paired / thr) * 100))}%</Badge>}
                      {pp && (
                        <Badge variant={ready ? "up" : "outline"} title={`→ ${pp.newPayout}`}>
                          {ready ? t("admin.takeover.ready") : <>{t("admin.takeover.pending")} · <Countdown eta={pp.eta} /></>}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {canAct && (
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void distribute(tok)}>{t("admin.act.distribute")}</Button>
                        {canGraduate && <Button size="sm" variant="gold" disabled={isBusy} onClick={() => void graduate(tok)}>{t("admin.act.graduate")}</Button>}
                        {pp ? (
                          <>
                            {ready && <Button size="sm" variant="up" disabled={isBusy} onClick={() => void takeover("executePayout", tok)}>{t("admin.act.execute")}</Button>}
                            <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void takeover("cancelPayoutProposal", tok)}>{t("admin.act.cancel")}</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => { setProposeFor(tok); setNewPayout(""); }}>{t("admin.act.propose")}</Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!proposeFor} onOpenChange={(o) => !o && setProposeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.act.propose")} · ${proposeFor?.symbol}</DialogTitle>
            <DialogDescription>{t("admin.takeover.hint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t("admin.ops.current")}: <span className="font-mono">{proposeFor?.payout}</span></div>
            <Input value={newPayout} onChange={(e) => setNewPayout(e.target.value.trim())} placeholder={`${t("admin.takeover.newPayout")} 0x…`} className="font-mono" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProposeFor(null)}>{t("admin.act.cancel")}</Button>
            <Button variant="gold" disabled={!isAddress(newPayout) || !!busy} onClick={() => void propose()}>{t("admin.act.propose")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}