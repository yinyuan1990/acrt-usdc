"use client";

import { toast } from "sonner";
import { X_HANDLE, X_URL } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";

/** The X brand mark (same glyph pons uses in its footer), boxed. */
export function XMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * Follow block: boxed X mark linking to the profile, with the copyable @handle underneath.
 * `row` lays the two out side by side for tight footers.
 */
export function XFollow({ row, className }: { row?: boolean; className?: string }) {
  const { t } = useApp();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`@${X_HANDLE}`);
      toast.success(t("common.copied"), { description: `@${X_HANDLE}` });
    } catch {}
  };
  return (
    <div className={cn("flex items-center gap-1.5", row ? "flex-row" : "flex-col", className)}>
      <a
        href={X_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="X"
        title={`@${X_HANDLE}`}
        className="inline-flex size-8 items-center justify-center rounded-md border border-foreground/15 text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <XMark size={14} />
      </a>
      <button type="button" onClick={copy} title={t("common.copy")} className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground">
        @{X_HANDLE}
      </button>
    </div>
  );
}
