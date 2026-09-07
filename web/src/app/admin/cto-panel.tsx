"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { toast } from "sonner";
import type { Address } from "viem";
import { ctoReviewMessage, postCtoStatus, useAdminCto, type CtoRequest } from "@/lib/api";
import { ADDR, lockerAbi } from "@/lib/web3";
import { useTx } from "@/lib/tx";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Addr, Empty, TimeAgo, errMsg } from "@/components/shared";

/** Off-chain takeover applications. "Approve" files the on-chain proposePayout() (48h timelock, creator veto)
 *  and then marks the request approved with an owner signature; "Reject" only signs. */
export function CtoPanel({ canAct }: { canAct: boolean }) {
  const { t, address } = useApp();
  const { data, isLoading } = useAdminCto(true);
  const { run } = useTx();
  const { signMessageAsync } = useSignMessage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<number | null>(null);

  const mark = async (r: CtoRequest, status: CtoRequest["status"]) => {
    if (!address) return;
    const ts = new Date().getTime();
    const signature = await signMessageAsync({ message: ctoReviewMessage(r.id, status, ts) });
    await postCtoStatus(r.id, { author: address, status, ts, signature });
    void qc.invalidateQueries({ queryKey: ["admin"] });
  };

  const approve = async (r: CtoRequest) => {
    setBusy(r.id);
    try {
      const rc = await run(`${t("admin.act.propose")} $${r.symbol}`, { address: ADDR.locker, abi: lockerAbi, functionName: "proposePayout", args: [r.token as Address, r.newPayout as Address] });
      if (rc) await mark(r, "approved");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const reject = async (r: CtoRequest) => {
    setBusy(r.id);
    try {
      await mark(r, "rejected");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return null;
  if (!data || data.length === 0) return <Empty>{t("admin.cto.empty")}</Empty>;

  const statusVariant = { open: "gold", approved: "up", rejected: "secondary" } as const;

  return (
    <div className="space-y-3">
      {data.map((r) => (
        <Card key={r.id} size="sm" className={r.status === "open" ? "ring-gold/40" : undefined}>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/token/${r.token}`} className="font-mono font-semibold hover:underline">${r.symbol}</Link>
              <Badge variant={statusVariant[r.status]}>{t(`cto.status.${r.status}`)}</Badge>
              <span className="text-xs text-muted-foreground">#{r.id} · <TimeAgo ts={r.time} /> ago</span>
              <div className="ml-auto flex gap-1">
                {canAct && r.status === "open" && (
                  <>
                    <Button size="sm" variant="gold" disabled={busy === r.id} onClick={() => void approve(r)}>{t("admin.cto.approve")}</Button>
                    <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => void reject(r)}>{t("admin.cto.reject")}</Button>
                  </>
                )}
              </div>
            </div>
            <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("admin.cto.requester")}</span><Addr value={r.requester} head={8} tail={6} /></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("admin.ops.current")}</span><Addr value={r.payout} head={8} tail={6} /></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("admin.takeover.newPayout")}</span><Addr value={r.newPayout} head={8} tail={6} className="text-gold" /></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t("cto.contact")}</span><span className="truncate">{r.contact || "—"}</span></div>
            </div>
            <p className="rounded-md bg-muted p-2 text-xs whitespace-pre-wrap text-secondary-foreground">{r.reason}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
