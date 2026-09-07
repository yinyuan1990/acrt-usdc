"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Languages, Menu, ShieldAlert, Wallet, Zap } from "lucide-react";
import { BookOpenText, ChartBar, Compass, Crown, Fire, RocketLaunch, Trophy, UserCircle, type Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useApp } from "@/components/providers";
import { useHealth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { shortAddr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SearchCommand } from "@/components/layout/search-command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Ticker } from "@/components/layout/ticker";
import { XFollow } from "@/components/layout/socials";
import type { DictKey } from "@/lib/i18n";

// Phosphor duotone icons: two-tone at rest, solid fill when active — reads far richer than hairline outlines.
const NAV: Array<{ href: string; key: DictKey; icon: PhosphorIcon }> = [
  { href: "/", key: "nav.explore", icon: Compass },
  { href: "/rank", key: "nav.rank", icon: Trophy },
  { href: "/analytics", key: "nav.analytics", icon: ChartBar },
  { href: "/create", key: "nav.create", icon: RocketLaunch },
  { href: "/creator", key: "nav.creator", icon: Crown },
  { href: "/burn", key: "nav.burn", icon: Fire },
  { href: "/me", key: "nav.me", icon: UserCircle },
  { href: "/docs", key: "nav.docs", icon: BookOpenText },
];

/** Icon in a small rounded tile; the tile tints with the accent colour when active. */
function NavIcon({ icon: Icon, active, size = 18 }: { icon: PhosphorIcon; active: boolean; size?: number }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        active ? "bg-sidebar-primary/20 text-sidebar-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" : "bg-foreground/[0.04] text-muted-foreground group-hover:bg-foreground/[0.08] group-hover:text-foreground",
      )}
    >
      <Icon size={size} weight={active ? "fill" : "duotone"} />
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, theme, setTheme, locale, setLocale, connected, address, wrongChain, toggleConnect } = useApp();
  // One fixed-width label for every state / language (width follows the Chinese "连接钱包").
  const walletLabel = wrongChain ? t("wallet.switchShort") : connected && address ? shortAddr(address, 4, 4) : t("wallet.btn");
  const walletBtnCls = "h-9 w-[7.5rem] justify-center px-2 font-mono";

  // The admin panel lives in the same app but gets its own frame: no public nav, no ticker, a loud header.
  if (pathname.startsWith("/admin")) {
    return (
      <TooltipProvider>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-gold/40 bg-background/90 backdrop-blur">
            <div className="h-1 w-full bg-gradient-to-r from-gold via-primary to-gold" />
            <div className="flex h-14 items-center gap-3 px-3 md:px-6">
              <Logo compact />
              <span className="inline-flex items-center gap-1.5 rounded-md border border-gold/50 bg-gold/10 px-2 py-1 font-mono text-xs font-semibold tracking-wider text-gold">
                <ShieldAlert size={13} /> {t("admin.badge")}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-9" asChild>
                  <Link href="/">{t("admin.backToSite")}</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Languages /> <span className="font-mono">{locale.toUpperCase()}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLocale("zh")}>中文</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocale("en")}>English</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" variant={wrongChain ? "gold" : connected ? "outline" : "glow"} onClick={toggleConnect} className={walletBtnCls}>
                  <Wallet />
                  <span className="truncate">{walletLabel}</span>
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-3 py-5 md:px-6">{children}</main>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
          <Logo />
          <nav className="flex-1 space-y-1 px-3">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-primary/10 font-medium text-sidebar-primary before:absolute before:top-1/2 before:left-0 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <NavIcon icon={n.icon} active={active} />
                  <span>{t(n.key)}</span>
                </Link>
              );
            })}
          </nav>
          <div className="space-y-3 border-t p-4">
            <XFollow className="items-start" />
            <Tabs value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
              <TabsList className="w-full">
                <TabsTrigger value="arc">{t("theme.arc")}</TabsTrigger>
                <TabsTrigger value="terminal">{t("theme.terminal")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center justify-between gap-2 text-[11px] whitespace-nowrap text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <Zap size={12} className="shrink-0 text-primary" /> Arc {t("common.testnet")} · {t("common.finality")}
              </span>
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="shrink-0 rounded-md border px-1.5 py-0.5 hover:border-primary/50 hover:text-foreground">
                {t("sidebar.faucet")}
              </a>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="flex h-14 items-center gap-2 px-3 md:gap-3 md:px-6">
              <MobileNav pathname={pathname} />
              <div className="lg:hidden">
                <Logo compact />
              </div>
              <div className="hidden flex-1 md:block">
                <SearchCommand className="h-9 w-full max-w-xl justify-start" />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <SearchCommand className="size-9 px-0 md:hidden [&>span]:hidden" />
                {/* language / theme switches live on the "Me" page (settings card) */}
                <Button variant="outline" size="sm" className="hidden h-9 md:inline-flex" asChild>
                  <Link href="/docs">
                    <BookOpen /> {t("nav.docs")}
                  </Link>
                </Button>
                <Button size="sm" variant={wrongChain ? "gold" : connected ? "outline" : "glow"} onClick={toggleConnect} className={walletBtnCls} title={connected && !wrongChain ? t("wallet.disconnect") : address}>
                  <Wallet />
                  <span className="truncate">{walletLabel}</span>
                </Button>
              </div>
            </div>
            <Ticker />
            <StatusBanner />
          </header>

          <main className="flex-1 px-3 pt-4 pb-10 md:px-6">{children}</main>

          <footer className="hidden border-t px-6 py-4 text-[11px] text-muted-foreground md:flex md:items-center md:justify-between md:gap-4">
            <span>{t("common.disclaimer")}</span>
            <span className="flex shrink-0 items-center gap-3">
              <XFollow row />
              <Link href="/analytics" className="hover:text-foreground">{t("nav.analytics")}</Link>
              <Link href="/docs" className="hover:text-foreground">{t("nav.docs")} →</Link>
            </span>
          </footer>
        </div>

      </div>
    </TooltipProvider>
  );
}

/** Mobile navigation: hamburger at the top-left opening a left drawer with the full nav + theme + socials. */
function MobileNav({ pathname }: { pathname: string }) {
  const { t, theme, setTheme } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="size-9 lg:hidden" aria-label="Menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-14 items-center border-b px-4">
          <Logo compact />
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn("group flex items-center gap-3 rounded-lg px-2 py-2 text-sm", active ? "bg-sidebar-primary/10 font-medium text-sidebar-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}
              >
                <NavIcon icon={n.icon} active={active} />
                <span>{t(n.key)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 border-t p-4">
          <XFollow row />
          <Tabs value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
            <TabsList className="w-full">
              <TabsTrigger value="arc">{t("theme.arc")}</TabsTrigger>
              <TabsTrigger value="terminal">{t("theme.terminal")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Zap size={12} className="text-primary" /> Arc {t("common.testnet")}</span>
            <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="rounded-md border px-1.5 py-0.5 hover:text-foreground">{t("sidebar.faucet")}</a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Degraded-service strip: indexer lagging the chain head or the API not answering. Arc does 0.5s blocks,
 *  so 120 blocks ≈ 1 minute of stale data — enough to mislead a trade. */
const LAG_BLOCKS = 120;

function StatusBanner() {
  const { t } = useApp();
  const { data, isError, failureCount } = useHealth();
  const lag = data?.head && data?.lastBlock ? data.head - data.lastBlock : 0;
  const down = isError && failureCount >= 2;
  if (!down && lag < LAG_BLOCKS) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-t border-gold/40 bg-gold/10 px-3 py-1.5 text-center text-[11px] text-gold">
      <ShieldAlert size={13} className="shrink-0" />
      <span>{down ? t("status.apiDown") : t("status.indexerLag").replace("{n}", String(lag))}</span>
    </div>
  );
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", compact ? "" : "h-14 px-5")}>
      <Image src="/brand/logo.png" alt="ArcLaunch" width={32} height={32} priority className="size-8 shrink-0 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]" />
      <span className="text-base font-bold tracking-tight">
        Arc<span className="text-primary">Launch</span>
      </span>
    </Link>
  );
}
