"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useSignMessage } from "wagmi";
import { isAddress } from "viem";
import { ctoMessage, postCto } from "@/lib/api";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errMsg } from "@/components/shared";

/** Community-takeover application. Wallet-signed (EIP-191), stored off-chain, reviewed in /admin. */
export function CtoForm({ token: preset }: { token?: string }) {
  const { t, connected, address, toggleConnect } = useApp();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState(preset ?? "");
  const [newPayout, setNewPayout] = useState("");
  const [contact, setContact] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const valid = isAddress(token) && isAddress(newPayout) && reason.trim().length >= 20;

  const submit = async () => {
    if (!address || !valid) return;
    setBusy(true);
    try {
      const ts = Date.now();
      const body = reason.trim();
      const c = contact.trim();
      const signature = await signMessageAsync({ message: ctoMessage(token, newPayout, c, body, ts) });
      await postCto({ token, requester: address, newPayout, contact: c, reason: body, ts, signature });
      setDone(true);
      toast.success(t("cto.submitted"));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-up/40 bg-up/10 p-4 text-sm">
        <ShieldCheck className="shrink-0 text-up" /> {t("cto.submitted")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cto-token" className="label">{t("cto.token")}</Label>
          <Input id="cto-token" value={token} onChange={(e) => setToken(e.target.value.trim())} placeholder="0x…" className="font-mono" disabled={!!preset} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cto-payout" className="label">{t("cto.newPayout")}</Label>
          <Input id="cto-payout" value={newPayout} onChange={(e) => setNewPayout(e.target.value.trim())} placeholder="0x…" className="font-mono" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cto-contact" className="label">{t("cto.contact")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
        <Input id="cto-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="@handle / t.me/…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cto-reason" className="label">{t("cto.reason")}</Label>
        <Textarea id="cto-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={1000} placeholder={t("cto.reasonPlaceholder")} className="resize-none" />
        <div className="text-right font-mono text-[11px] text-muted-foreground">{reason.length}/1000</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">{t("cto.signHint")} · {t("cto.never")}</span>
        <Button disabled={connected && (!valid || busy)} onClick={connected ? submit : toggleConnect}>
          {connected ? (busy ? t("tx.confirming") : t("common.submit")) : t("common.connect")}
        </Button>
      </div>
    </div>
  );
}
