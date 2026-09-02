"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ImagePlus, Lock, Rocket, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { formatUnits, parseEventLogs, parseUnits, type Address } from "viem";
import { fetchLaunchQuote, uploadLogo, useConfig } from "@/lib/api";
import { fmtUsd } from "@/lib/format";
import { ADDR, SUPPLY_TOKENS, erc20Abi, factoryAbi } from "@/lib/web3";
import { useTx } from "@/lib/tx";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TokenAvatar, errMsg } from "@/components/shared";

const STEPS = ["create.step1", "create.step2", "create.step3"] as const;
const EMOJIS = ["🚀", "🐱", "🐕", "🐸", "🦊", "🌕", "💎", "🔥", "🧊", "🦄"];
const MCAPS = [1000, 2000, 5000, 10000, 25000];

export default function CreatePage() {
  const { t, connected, address, wrongChain, toggleConnect } = useApp();
  const { run, client } = useTx();
  const router = useRouter();
  const qc = useQueryClient();
  const cfg = useConfig().data;

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [emoji, setEmoji] = useState("🚀");
  const [logoUrl, setLogoUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [startMcap, setStartMcap] = useState(5000);
  const [initialBuy, setInitialBuy] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "launch">(null);
  const [uploading, setUploading] = useState(false);

  const onPickFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 1024 * 1024) return toast.error("max 1 MB");
    setUploading(true);
    try {
      const { url } = await uploadLogo(file);
      setLogoUrl(url);
      toast.success(t("create.uploaded"));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(false);
    }
  };

  const me = address as Address | undefined;
  const feeQ = useReadContract({ address: ADDR.factory, abi: factoryAbi, functionName: "quoteCreationFee", args: me ? [me] : undefined, query: { enabled: !!me } });
  const balQ = useReadContract({ address: ADDR.usdc, abi: erc20Abi, functionName: "balanceOf", args: me ? [me] : undefined, query: { enabled: !!me, refetchInterval: 8000 } });

  const baseFee = cfg ? Number(cfg.params.creationFee) / 1e6 : 2;
  const feeEnabled = cfg?.params.creationFeeEnabled ?? true;
  const fee6 = feeQ.data ?? (feeEnabled ? BigInt(Math.round(baseFee * 1e6)) : 0n);
  const fee = Number(fee6) / 1e6;
  const waived = !!me && feeEnabled && fee6 === 0n;
  const buy = parseFloat(initialBuy) || 0;
  const buy6 = (() => { try { return buy > 0 ? parseUnits(String(buy), 6) : 0n; } catch { return 0n; } })();
  const need6 = fee6 + buy6;
  const balance = balQ.data ?? 0n;
  const insufficient = connected && need6 > balance;
  const startPrice = startMcap / SUPPLY_TOKENS;
  const logo = logoUrl.trim() ? logoUrl.trim() : `emoji:${emoji}`;
  const canNext = step === 0 ? name.trim().length > 1 && symbol.trim().length > 0 : true;

  const launch = async () => {
    if (!me || !client) return;
    setBusy("approve");
    try {
      // fresh quote right before sending: orientation depends on the factory nonce at execution time
      const q = await fetchLaunchQuote(startMcap, me);
      if (need6 > 0n) {
        const allowance = await client.readContract({ address: ADDR.usdc, abi: erc20Abi, functionName: "allowance", args: [me, ADDR.factory] });
        if (allowance < need6) {
          const rc = await run(t("create.step.approve"), { address: ADDR.usdc, abi: erc20Abi, functionName: "approve", args: [ADDR.factory, need6] });
          if (!rc) return;
        }
      }
      setBusy("launch");
      const rc = await run(t("create.step.launch"), {
        address: ADDR.factory,
        abi: factoryAbi,
        functionName: "launch",
        args: [{
          name: name.trim(),
          symbol: symbol.trim(),
          logo,
          description: desc.trim(),
          socials: { website: website.trim(), twitter: twitter.trim(), telegram: telegram.trim() },
          sqrtPriceX96: BigInt(q.sqrtPriceX96),
          initialBuyUsdc: buy6,
          minTokensOut: 0n,
        }],
      });
      if (!rc) return;
      const logs = parseEventLogs({ abi: factoryAbi, logs: rc.logs, eventName: "TokenLaunched" });
      const tokenAddr = logs[0]?.args.token;
      toast.success(t("tx.launched"), { description: tokenAddr });
      void qc.invalidateQueries({ queryKey: ["tokens"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
      // give the indexer a moment to pick the block up
      setTimeout(() => router.push(tokenAddr ? `/token/${tokenAddr}` : "/"), 2500);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-secondary-foreground">{t("create.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardContent className="md:px-6">
            <ol className="mb-6 flex items-center gap-2 text-xs">
              {STEPS.map((k, i) => (
                <li key={k} className="flex items-center gap-2">
                  <button type="button" onClick={() => i < step && setStep(i)} className={cn("flex size-6 items-center justify-center rounded-full font-mono", i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-up text-black" : "bg-muted text-muted-foreground")}>
                    {i + 1}
                  </button>
                  <span className={cn("hidden sm:inline", i === step ? "text-foreground" : "text-muted-foreground")}>{t(k)}</span>
                  {i < STEPS.length - 1 && <Separator className="w-6! md:w-10!" />}
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <Field label={t("create.name")} htmlFor="name"><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="Arc Cat" /></Field>
                  <Field label={t("create.symbol")} htmlFor="symbol"><Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={10} placeholder="ACAT" className="font-mono uppercase" /></Field>
                </div>
                <Field label={t("create.logo")} hint={t("create.dropLogo")}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <label className={cn("flex size-28 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-input text-[11px] text-muted-foreground hover:border-ring hover:text-foreground", uploading && "opacity-60")}>
                      {logoUrl && /^https?:/.test(logoUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <>
                          <ImagePlus size={20} />
                          <span className="px-2 text-center leading-tight">{uploading ? t("create.uploading") : t("create.upload")}</span>
                        </>
                      )}
                      <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" disabled={uploading} onChange={(e) => void onPickFile(e.target.files?.[0])} />
                    </label>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {EMOJIS.map((e) => (
                          <Button key={e} type="button" variant={emoji === e && !logoUrl ? "default" : "secondary"} size="icon-lg" className="text-lg" onClick={() => { setEmoji(e); setLogoUrl(""); }}>{e}</Button>
                        ))}
                      </div>
                      <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
                    </div>
                  </div>
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <Field label={t("create.description")} htmlFor="desc">
                  <Textarea id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} rows={4} placeholder="The first cat on Arc…" className="resize-none" />
                  <div className="mt-1 text-right font-mono text-[11px] text-muted-foreground">{desc.length}/280</div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("create.website")} htmlFor="web"><Input id="web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></Field>
                  <Field label={t("create.twitter")} htmlFor="x"><Input id="x" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" /></Field>
                  <Field label={t("create.telegram")} htmlFor="tg"><Input id="tg" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" /></Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Field label={t("create.startMcap")} hint={t("create.startMcapHint")}>
                  <div className="grid grid-cols-5 gap-2">
                    {MCAPS.map((v) => (
                      <Button key={v} type="button" variant={startMcap === v ? "default" : "outline"} className="font-mono" onClick={() => setStartMcap(v)}>{fmtUsd(v, { compact: true })}</Button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{t("common.price")}</span>
                    <span className="font-mono tabular">{fmtUsd(startPrice)} / {symbol || "TOKEN"}</span>
                  </div>
                </Field>

                <Field label={t("create.initialBuy")} hint={t("create.initialBuyHint")} htmlFor="buy">
                  <div className="flex items-center gap-2 rounded-lg border border-input bg-muted px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
                    <input id="buy" type="number" inputMode="decimal" value={initialBuy} onChange={(e) => setInitialBuy(e.target.value)} placeholder="0.00" className="min-w-0 flex-1 bg-transparent font-mono text-lg outline-none tabular placeholder:text-muted-foreground" />
                    <span className="rounded-md bg-accent px-2 py-1 font-mono text-xs">USDC</span>
                  </div>
                  {connected && <div className="mt-1 text-right font-mono text-[11px] text-muted-foreground">{t("common.balance")}: {fmtUsd(Number(formatUnits(balance, 6)))}</div>}
                </Field>

                <ul className="grid gap-2 text-xs text-secondary-foreground sm:grid-cols-3">
                  <Li icon={<Lock size={13} />}>{t("token.lpLocked")}</Li>
                  <Li icon={<ShieldCheck size={13} />}>{t("token.protectionActive")}</Li>
                  <Li icon={<Zap size={13} />}>{t("common.finality")} · {t("common.usdcSettled")}</Li>
                </ul>
              </div>
            )}

            <Separator className="my-5" />
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>{t("common.back")}</Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>{t("common.next")}</Button>
              ) : (
                <Button size="xl" variant="glow" onClick={!connected || wrongChain ? toggleConnect : launch} disabled={connected && !wrongChain && (insufficient || !!busy || !canNext)}>
                  <Rocket />
                  {!connected ? t("common.connect") : wrongChain ? t("wallet.switch") : insufficient ? t("tx.insufficient") : busy === "approve" ? t("create.step.approve") : busy === "launch" ? t("create.step.launch") : t("create.launchBtn")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card size="sm">
            <CardHeader><CardTitle className="label">{t("create.preview")}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <TokenAvatar logo={logo} symbol={symbol || "TKN"} seed={name + symbol} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{name || "Token name"}</span>
                    <span className="font-mono text-xs text-muted-foreground">${symbol || "TKN"}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-secondary-foreground">{desc || "…"}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold tabular">{fmtUsd(startPrice)}</div>
                  <div className="text-[11px] text-muted-foreground">{fmtUsd(startMcap, { compact: true })} mcap</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader><CardTitle className="label">{t("create.summary")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("create.fee")}</span>
                <span className="flex items-center gap-2 font-mono tabular">
                  {fee === 0 ? (
                    <>
                      <span className="text-muted-foreground line-through">{fmtUsd(baseFee)}</span>
                      <Badge variant="up"><BadgeCheck /> {waived ? t("create.feeWaived") : t("create.feeFree")}</Badge>
                    </>
                  ) : fmtUsd(fee)}
                </span>
              </div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">{t("create.initialBuy")}</span><span className="font-mono tabular">{fmtUsd(buy)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Gas (USDC)</span><span className="font-mono tabular">~$0.2</span></div>
              <Separator />
              <div className="flex items-center justify-between font-semibold"><span>{t("common.total")}</span><span className="font-mono tabular">{fmtUsd(fee + buy + 0.2)}</span></div>
              {insufficient && <div className="text-xs text-down">{t("tx.insufficient")} · <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">{t("tx.faucet")}</a></div>}
            </CardContent>
          </Card>

          <Card size="sm" className="bg-gradient-to-br from-up/15 to-card ring-up/30">
            <CardHeader>
              <CardTitle className="label text-up!">{t("create.youGet")}</CardTitle>
              <CardDescription><span className="font-mono text-3xl font-bold text-up">{(cfg?.params.creatorShareBps ?? 7500) / 100}%</span></CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-secondary-foreground">{t("create.youGetDesc")}</CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="label">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Li({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-lg bg-muted p-2.5">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
