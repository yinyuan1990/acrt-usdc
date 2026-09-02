"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Flame, Languages, Palette, Plus, Rocket, Trophy, User, Wallet, Zap } from "lucide-react";
import { useApp } from "@/components/providers";
import { cn } from "@/lib/utils";
import { shortAddr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchCommand } from "@/components/layout/search-command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  const { t, theme, setTheme, locale, setLocale, connected, address, wrongChain, toggleConnect } = useApp();
  const walletLabel = wrongChain ? t("wallet.switch") : connected && address ? shortAddr(address, 6, 4) : t("common.connect");
  const walletLabelShort = wrongChain ? t("wallet.switch") : connected && address ? shortAddr(address, 4, 3) : t("common.connect");

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
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active ? "bg-sidebar-primary/15 text-sidebar-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <n.icon size={18} />
                  <span>{t(n.key)}</span>
                </Link>
              );
            })}
          </nav>
          <div className="space-y-3 border-t p-4">
            <Tabs value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
              <TabsList className="w-full">
                <TabsTrigger value="arc">{t("theme.arc")}</TabsTrigger>
                <TabsTrigger value="terminal">{t("theme.terminal")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Zap size={12} className="text-primary" /> Arc {t("common.testnet")} · {t("common.finality")}
              </span>
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">
                {t("tx.faucet")}
              </a>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
            <div className="flex h-14 items-center gap-3 px-3 md:px-6">
              <div className="lg:hidden">
                <Logo compact />
              </div>
              <div className="hidden flex-1 md:block">
                <SearchCommand className="h-9 w-full max-w-xl justify-start" />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <SearchCommand className="size-9 px-0 md:hidden [&>span]:hidden" />
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 lg:hidden">
                      <Palette /> <span className="font-mono">{theme === "arc" ? "ARC" : "TERM"}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setTheme("arc")}>{t("theme.arc")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("terminal")}>{t("theme.terminal")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" className="hidden h-9 md:inline-flex" asChild>
                  <a href="https://docs.arc.io" target="_blank" rel="noreferrer">
                    <BookOpen /> {t("nav.docs")}
                  </a>
                </Button>
                <Button size="sm" variant={wrongChain ? "gold" : connected ? "outline" : "glow"} onClick={toggleConnect} className="h-9" title={connected && !wrongChain ? t("wallet.disconnect") : undefined}>
                  <Wallet />
                  <span className="hidden font-mono sm:inline">{walletLabel}</span>
                  <span className="font-mono sm:hidden">{walletLabelShort}</span>
                </Button>
              </div>
            </div>
            <Ticker />
          </header>

          <main className="flex-1 px-3 pt-4 pb-24 md:px-6 md:pb-10">{children}</main>

          <footer className="hidden border-t px-6 py-4 text-[11px] text-muted-foreground md:block">{t("common.disclaimer")}</footer>
        </div>

        {/* Mobile bottom nav */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur lg:hidden">
          <div className="grid grid-cols-5">
            {NAV.filter((n) => n.href !== "/burn").map((n) => {
              const active = isActive(pathname, n.href);
              const isCreate = n.href === "/create";
              return (
                <Link key={n.href} href={n.href} className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]">
                  {isCreate ? (
                    <span className="-mt-5 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
                      <n.icon size={22} />
                    </span>
                  ) : (
                    <n.icon size={20} className={active ? "text-primary" : "text-muted-foreground"} />
                  )}
                  <span className={cn(active ? "text-primary" : "text-muted-foreground", isCreate && "mt-0.5")}>{t(n.key)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", compact ? "" : "h-14 px-5")}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
        <Rocket size={16} />
      </span>
      <span className="text-base font-bold tracking-tight">
        Arc<span className="text-primary">Launch</span>
      </span>
    </Link>
  );
}
