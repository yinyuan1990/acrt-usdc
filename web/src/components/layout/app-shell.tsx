"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Flame, Languages, Plus, Rocket, Search, Trophy, User, Wallet, Zap } from "lucide-react";
import { useApp } from "@/components/providers";
import { Button, cn } from "@/components/ui";
import { Ticker } from "@/components/layout/ticker";
import type { DictKey } from "@/lib/i18n";

const NAV: Array<{ href: string; key: DictKey; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { href: "/", key: "nav.explore", icon: Compass },
  { href: "/rank", key: "nav.rank", icon: Trophy },
  { href: "/create", key: "nav.create", icon: Plus },
  { href: "/creator", key: "nav.creator", icon: Rocket },
  { href: "/burn", key: "nav.burn", icon: Flame },
  { href: "/me", key: "nav.me", icon: User },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, theme, setTheme, locale, setLocale, connected, toggleConnect } = useApp();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-bg-2/60 backdrop-blur lg:flex">
        <Logo />
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-accent-soft text-accent-hi" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                )}
              >
                <n.icon size={18} />
                <span>{t(n.key)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-line p-4">
          <ThemeSwitch />
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Zap size={12} className="text-accent" /> Arc · {t("common.finality")}
            </span>
            <span>{t("common.usdcSettled")}</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-3 md:px-6">
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <div className="relative hidden flex-1 md:block">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input
                placeholder={t("common.search")}
                className="h-9 w-full max-w-xl rounded-btn border border-line bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:border-accent"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
                className="inline-flex h-9 items-center gap-1 rounded-btn border border-line px-2.5 text-xs text-fg-2 hover:bg-surface-2"
                title="Language"
              >
                <Languages size={14} />
                <span className="font-mono">{locale.toUpperCase()}</span>
              </button>
              <button
                onClick={() => setTheme(theme === "arc" ? "terminal" : "arc")}
                className="inline-flex h-9 items-center rounded-btn border border-line px-2.5 text-xs text-fg-2 hover:bg-surface-2 lg:hidden"
                title="Theme"
              >
                <span className="font-mono">{theme === "arc" ? "ARC" : "TERM"}</span>
              </button>
              <a
                href="https://docs.arc.io"
                target="_blank"
                rel="noreferrer"
                className="hidden h-9 items-center gap-1 rounded-btn border border-line px-2.5 text-xs text-fg-2 hover:bg-surface-2 md:inline-flex"
              >
                <BookOpen size={14} /> {t("nav.docs")}
              </a>
              <Button size="sm" variant={connected ? "outline" : "primary"} onClick={toggleConnect} className="h-9">
                <Wallet size={14} />
                <span className="hidden sm:inline">{connected ? "0x7a3f…c21e" : t("common.connect")}</span>
                <span className="sm:hidden">{connected ? "0x7a…1e" : t("common.connect")}</span>
              </Button>
            </div>
          </div>
          <Ticker />
        </header>

        <main className="flex-1 px-3 pt-4 pb-24 md:px-6 md:pb-10">{children}</main>

        <footer className="hidden border-t border-line px-6 py-4 text-[11px] text-muted md:block">{t("common.disclaimer")}</footer>
      </div>

      {/* Mobile bottom nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => n.href !== "/burn").map((n) => {
            const active = isActive(pathname, n.href);
            const isCreate = n.href === "/create";
            return (
              <Link key={n.href} href={n.href} className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]">
                {isCreate ? (
                  <span className="-mt-5 flex h-11 w-11 items-center justify-center rounded-pill bg-accent text-accent-fg shadow-glow">
                    <n.icon size={22} />
                  </span>
                ) : (
                  <n.icon size={20} className={active ? "text-accent-hi" : "text-muted"} />
                )}
                <span className={cn(active ? "text-accent-hi" : "text-muted", isCreate && "mt-0.5")}>{t(n.key)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", compact ? "" : "h-14 px-5")}>
      <span className="flex h-8 w-8 items-center justify-center rounded-btn bg-accent text-accent-fg shadow-glow">
        <Rocket size={16} />
      </span>
      <span className="font-display text-base font-bold tracking-tight">
        Arc<span className="text-accent-hi">Launch</span>
      </span>
    </Link>
  );
}

function ThemeSwitch() {
  const { theme, setTheme, t } = useApp();
  return (
    <div className="grid grid-cols-2 gap-1 rounded-btn bg-surface-2 p-1">
      {(["arc", "terminal"] as const).map((th) => (
        <button
          key={th}
          onClick={() => setTheme(th)}
          className={cn(
            "rounded-xs px-2 py-1.5 text-xs transition-colors",
            theme === th ? "bg-surface-3 text-fg shadow-card" : "text-muted hover:text-fg",
          )}
        >
          {t(th === "arc" ? "theme.arc" : "theme.terminal")}
        </button>
      ))}
    </div>
  );
}
