"use client";

import { MessageSquare } from "lucide-react";
import type { TokenView } from "@/lib/api";
import { useApp } from "@/components/providers";

/** Placeholder until the off-chain (wallet-signed) comment service ships. */
export function Thread({ token }: { token: TokenView }) {
  const { t } = useApp();
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
      <MessageSquare size={20} />
      <div>{t("thread.soon")}</div>
      <div className="font-mono text-xs">${token.symbol}</div>
    </div>
  );
}
