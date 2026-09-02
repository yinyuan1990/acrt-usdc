"use client";

import { useState } from "react";
import { BadgeCheck, ImagePlus, Lock, Rocket, ShieldCheck, Zap } from "lucide-react";
import { PLATFORM, SUPPLY } from "@/lib/mock";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TokenAvatar } from "@/components/shared";

const STEPS = ["create.step1", "create.step2", "create.step3"] as const;
const EMOJIS = ["🚀", "🐱", "🐕", "🐸", "🦊", "🌕", "💎", "🔥", "🧊", "🦄"];

export default function CreatePage() {
  const { t, connected, toggleConnect } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [emoji, setEmoji] = useState("🚀");
  const [desc, setDesc] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [startMcap, setStartMcap] = useState(5000);
  const [initialBuy, setInitialBuy] = useState("");

  const whitelisted = false; // mock: Factory.isFeeWaived(address)
  const feeEnabled = PLATFORM.creationFeeEnabled && PLATFORM.creationFee > 0;
  const fee = whitelisted || !feeEnabled ? 0 : PLATFORM.creationFee;
  const buy = parseFloat(initialBuy) || 0;
  const startPrice = startMcap / SUPPLY;
  const hue = (name.length * 37 + symbol.length * 91) % 360;

  const canNext = step === 0 ? name.trim().length > 1 && symbol.trim().length > 0 : true;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-secondary-foreground">{t("create.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Form */}
        <Card>
          <CardContent className="md:px-6">
            {/* Stepper */}
            <ol className="mb-6 flex items-center gap-2 text-xs">
              {STEPS.map((k, i) => (
                <li key={k} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full font-mono",
                      i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-up text-black" : "bg-muted text-muted-foreground",
                    )}
                  >
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
                  <Field label={t("create.name")} htmlFor="name">
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="Arc Cat" />
                  </Field>
                  <Field label={t("create.symbol")} htmlFor="symbol">
                    <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={10} placeholder="ACAT" className="font-mono uppercase" />
                  </Field>
                </div>
                <Field label={t("create.logo")}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className="flex size-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-[11px] text-muted-foreground hover:border-ring hover:text-foreground"
                    >
                      <ImagePlus size={20} />
                      <span className="px-2 text-center leading-tight">{t("create.dropLogo")}</span>
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      {EMOJIS.map((e) => (
                        <Button key={e} type="button" variant={emoji === e ? "default" : "secondary"} size="icon-lg" className="text-lg" onClick={() => setEmoji(e)}>
                          {e}
                        </Button>
                      ))}
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
                  <Field label={t("create.website")} htmlFor="web">
                    <Input id="web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
                  </Field>
                  <Field label={t("create.twitter")} htmlFor="x">
                    <Input id="x" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" />
                  </Field>
                  <Field label={t("create.telegram")} htmlFor="tg">
                    <Input id="tg" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" />
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Field label={t("create.startMcap")} hint={t("create.startMcapHint")}>
                  <div className="grid grid-cols-4 gap-2">
                    {[2000, 5000, 10000, 25000].map((v) => (
                      <Button key={v} type="button" variant={startMcap === v ? "default" : "outline"} className="font-mono" onClick={() => setStartMcap(v)}>
                        {fmtUsd(v, { compact: true })}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{t("common.price")}</span>
                    <span className="font-mono tabular">
                      {fmtUsd(startPrice)} / {symbol || "TOKEN"}
                    </span>
                  </div>
                </Field>

                <Field label={t("create.initialBuy")} hint={t("create.initialBuyHint")} htmlFor="buy">
                  <div className="flex items-center gap-2 rounded-lg border border-input bg-muted px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
                    <input
                      id="buy"
                      type="number"
                      inputMode="decimal"
                      value={initialBuy}
                      onChange={(e) => setInitialBuy(e.target.value)}
                      placeholder="0.00"
                      className="min-w-0 flex-1 bg-transparent font-mono text-lg outline-none tabular placeholder:text-muted-foreground"
                    />
                    <span className="rounded-md bg-accent px-2 py-1 font-mono text-xs">USDC</span>
                  </div>
                </Field>

                <ul className="grid gap-2 text-xs text-secondary-foreground sm:grid-cols-3">
                  <Li icon={<Lock size={13} />}>{t("token.lpLocked")}</Li>
                  <Li icon={<ShieldCheck size={13} />}>{t("token.protectionActive")}</Li>
                  <Li icon={<Zap size={13} />}>
                    {t("common.finality")} · {t("common.usdcSettled")}
                  </Li>
                </ul>
              </div>
            )}

            <Separator className="my-5" />
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                {t("common.back")}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                  {t("common.next")}
                </Button>
              ) : (
                <Button size="xl" variant="glow" onClick={connected ? undefined : toggleConnect}>
                  <Rocket /> {connected ? t("create.launchBtn") : t("common.connect")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview + summary */}
        <aside className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="label">{t("create.preview")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <TokenAvatar emoji={emoji} hue={hue} size={48} />
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
            <CardHeader>
              <CardTitle className="label">{t("create.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("create.fee")}</span>
                <span className="flex items-center gap-2 font-mono tabular">
                  {fee === 0 ? (
                    <>
                      <span className="text-muted-foreground line-through">{fmtUsd(PLATFORM.creationFee)}</span>
                      <Badge variant="up">
                        <BadgeCheck /> {whitelisted ? t("create.feeWaived") : t("create.feeFree")}
                      </Badge>
                    </>
                  ) : (
                    fmtUsd(fee)
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("create.initialBuy")}</span>
                <span className="font-mono tabular">{fmtUsd(buy)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gas (USDC)</span>
                <span className="font-mono tabular">~$0.01</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>{t("common.total")}</span>
                <span className="font-mono tabular">{fmtUsd(fee + buy + 0.01)}</span>
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="bg-gradient-to-br from-up/15 to-card ring-up/30">
            <CardHeader>
              <CardTitle className="label text-up!">{t("create.youGet")}</CardTitle>
              <CardDescription>
                <span className="font-mono text-3xl font-bold text-up">{PLATFORM.creatorShare}%</span>
              </CardDescription>
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
      <Label htmlFor={htmlFor} className="label">
        {label}
      </Label>
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
