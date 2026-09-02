"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { type DictKey, translate } from "@/lib/i18n";
import { localeStore, themeStore, type Locale, type Theme } from "@/lib/store";
import { wagmiConfig, chain } from "@/lib/web3";

export type { Theme, Locale };

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: DictKey) => string;
  connected: boolean;
  address?: `0x${string}`;
  wrongChain: boolean;
  toggleConnect: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <Inner>{children}</Inner>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function Inner({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.getServer);
  const locale = useSyncExternalStore(localeStore.subscribe, localeStore.get, localeStore.getServer);
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const wrongChain = isConnected && chainId !== chain.id;

  const value = useMemo<Ctx>(
    () => ({
      theme,
      setTheme: themeStore.set,
      locale,
      setLocale: localeStore.set,
      t: (k) => translate(k, locale),
      connected: isConnected,
      address,
      wrongChain,
      toggleConnect: async () => {
        if (isConnected) {
          if (wrongChain) {
            try {
              await switchChainAsync({ chainId: chain.id });
            } catch (e) {
              toast.error((e as Error).message.split("\n")[0]);
            }
            return;
          }
          disconnect();
          return;
        }
        const injectedConnector = connectors.find((c) => c.type === "injected") ?? connectors[0];
        if (!injectedConnector) return;
        try {
          await connectAsync({ connector: injectedConnector, chainId: chain.id });
        } catch (e) {
          const msg = (e as Error).message;
          toast.error(/provider|not found|No injected/i.test(msg) ? translate("wallet.notFound", locale) : msg.split("\n")[0]);
        }
      },
    }),
    [theme, locale, isConnected, address, wrongChain, connectors, connectAsync, disconnect, switchChainAsync],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProviders");
  return ctx;
}
