"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { type DictKey, translate } from "@/lib/i18n";
import { localeStore, themeStore, type Locale, type Theme } from "@/lib/store";

export type { Theme, Locale };

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: DictKey) => string;
  connected: boolean;
  toggleConnect: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.getServer);
  const locale = useSyncExternalStore(localeStore.subscribe, localeStore.get, localeStore.getServer);
  const [connected, setConnected] = useState(false);

  const value = useMemo<Ctx>(
    () => ({
      theme,
      setTheme: themeStore.set,
      locale,
      setLocale: localeStore.set,
      t: (k) => translate(k, locale),
      connected,
      toggleConnect: () => setConnected((c) => !c),
    }),
    [theme, locale, connected],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProviders");
  return ctx;
}
