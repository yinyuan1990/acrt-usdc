"use client";

import { useState } from "react";
import { BadgeCheck, ImagePlus, Lock, Rocket, ShieldCheck, Zap } from "lucide-react";
import { PLATFORM, SUPPLY } from "@/lib/mock";
import { fmtUsd } from "@/lib/format";
import { useApp } from "@/components/providers";
import { Badge, Button, TokenAvatar, cn } from "@/components/ui";

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

  const whitelisted = false; // mock: read from Factory.isFeeWaived(address)
  const feeEnabled = PLATFORM.creationFeeEnabled && PLATFORM.creationFee > 0;
  const fee = whitelisted || !feeEnabled ? 0 : PLATFORM.creationFee;
  const buy = parseFloat(initialBuy) || 0;
  const startPrice = startMcap / SUPPLY;
  const hue = (name.length * 37 + symbol.length * 91) % 360;

  const canNext = step === 0 ? name.trim().length > 1 && symbol.trim().length > 0 : true;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-fg-2">{t("create.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Form */}
        <div className="card p-4 md:p-6">
          {/* Stepper */}
          <ol className="mb-6 flex items-center gap-2 text-xs">
            {STEPS.map((k, i) => (
              <li key={k} className="flex items-center gap-2">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-pill font-mono",
                    i === step ? "bg-accent text-accent-fg" : i < step ? "bg-up text-black" : "bg-surface-2 text-muted",
                  )}
                >
                  {i + 1}
                </button>
                <span className={cn("hidden sm:inline", i === step ? "text-fg" : "text-muted")}>{t(k)}</span>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-line md:w-10" />}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field label={t("create.name")}>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="Arc Cat" className={inputCls} />
                </Field>
                <Field label={t("create.symbol")}>
                  <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={10} placeholder="ACAT" className={cn(inputCls, "font-mono uppercase")} />
                </Field>
              </div>
              <Field label={t("create.logo")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-btn border border-dashed border-line-strong text-[11px] text-muted hover:border-accent hover:text-fg">
                    <ImagePlus size={20} />
                    <span className="px-2 text-center leading-tight">{t("create.dropLogo")}</span>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJIS.map((e) => (
                      <button key={e} onClick={() => setEmoji(e)} className={cn("h-9 w-9 rounded-btn text-lg", emoji === e ? "bg-accent-soft ring-1 ring-accent" : "bg-surface-2 hover:bg-surface-3")}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Field label={t("create.description")}>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} rows={4} placeholder="The first cat on Arc…" className={cn(inputCls, "h-auto resize-none py-2")} />
                <div className="mt-1 text-right font-mono text-[11px] text-muted">{desc.length}/280</div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("create.website")}>
                  <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className={inputCls} />
                </Field>
                <Field label={t("create.twitter")}>
                  <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" className={inputCls} />
                </Field>
                <Field label={t("create.telegram")}>
                  <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Field label={t("create.startMcap")} hint={t("create.startMcapHint")}>
                <div className="grid grid-cols-4 gap-2">
                  {[2000, 5000, 10000, 25000].map((v) => (
                    <button key={v} onClick={() => setStartMcap(v)} className={cn("rounded-btn border py-2 font-mono text-sm", startMcap === v ? "border-accent bg-accent-soft text-accent-hi" : "border-line hover:bg-surface-2")}>
                      {fmtUsd(v, { compact: true })}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between rounded-btn bg-surface-2 px-3 py-2 text-xs">
                  <span className="text-muted">{t("common.price")}</span>
                  <span className="font-mono tabular">{fmtUsd(startPrice)} / {symbol || "TOKEN"}</span>
                </div>
              </Field>

              <Field label={t("create.initialBuy")} hint={t("create.initialBuyHint")}>
                <div className="flex items-center gap-2 rounded-btn border border-line bg-surface-2 px-3 py-2 focus-within:border-accent">
                  <input type="number" inputMode="decimal" value={initialBuy} onChange={(e) => setInitialBuy(e.target.value)} placeholder="0.00" className="min-w-0 flex-1 bg-transparent font-mono text-lg outline-none tabular placeholder:text-muted" />
                  <span className="rounded-xs bg-surface-3 px-2 py-1 font-mono text-xs">USDC</span>
                </div>
              </Field>

              <ul className="grid gap-2 text-xs text-fg-2 sm:grid-cols-3">
                <Li icon={<Lock size={13} />}>{t("token.lpLocked")}</Li>
                <Li icon={<ShieldCheck size={13} />}>{t("token.protectionActive")}</Li>
                <Li icon={<Zap size={13} />}>{t("common.finality")} · {t("common.usdcSettled")}</Li>
              </ul>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              {t("common.back")}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                {t("common.next")}
              </Button>
            ) : (
              <Button size="lg" onClick={connected ? undefined : toggleConnect}>
                <Rocket size={16} /> {connected ? t("create.launchBtn") : t("common.connect")}
              </Button>
            )}
          </div>
        </div>

        {/* Preview + summary */}
        <aside className="space-y-4">
          <div className="card p-4">
            <div className="label mb-3 text-[11px] text-muted">{t("create.preview")}</div>
            <div className="flex items-start gap-3">
              <TokenAvatar emoji={emoji} hue={hue} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{name || "Token name"}</span>
                  <span className="font-mono text-xs text-muted">${symbol || "TKN"}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-fg-2">{desc || "…"}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-semibold tabular">{fmtUsd(startPrice)}</div>
                <div className="text-[11px] text-muted">{fmtUsd(startMcap, { compact: true })} mcap</div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="label mb-3 text-[11px] text-muted">{t("create.summary")}</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">{t("create.fee")}</span>
                <span className="flex items-center gap-2 font-mono tabular">
                  {fee === 0 ? (
                    <>
                      <span className="text-muted line-through">{fmtUsd(PLATFORM.creationFee)}</span>
                      <Badge tone="up">
                        <BadgeCheck size={11} /> {whitelisted ? t("create.feeWaived") : t("create.feeFree")}
                      </Badge>
                    </>
                  ) : (
                    fmtUsd(fee)
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">{t("create.initialBuy")}</span>
                <span className="font-mono tabular">{fmtUsd(buy)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Gas (USDC)</span>
                <span className="font-mono tabular">~$0.01</span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2 font-semibold">
                <span>{t("common.total")}</span>
                <span className="font-mono tabular">{fmtUsd(fee + buy + 0.01)}</span>
              </div>
            </div>
          </div>

          <div className="card border-up/30 bg-gradient-to-br from-up-soft to-surface p-4">
            <div className="label text-[11px] text-up">{t("create.youGet")}</div>
            <div className="mt-1 font-mono text-3xl font-bold text-up">{PLATFORM.creatorShare}%</div>
            <p className="mt-1 text-xs text-fg-2">{t("create.youGetDesc")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-btn border border-line bg-surface-2 px-3 text-sm outline-none placeholder:text-muted focus:border-accent";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="label mb-1.5 text-[11px] text-muted">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{hint}</p>}
    </label>
  );
}

function Li({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-btn bg-surface-2 p-2.5">
      <span className="mt-0.5 text-accent">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
