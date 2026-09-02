"use client";

import { useState } from "react";
import { CornerDownRight, Heart, Send } from "lucide-react";
import { toast } from "sonner";
import type { Token } from "@/lib/mock";
import { commentsFor } from "@/lib/mock";
import { shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TimeAgo } from "@/components/shared";

/** pump.fun-style comment thread on the token page. */
export function Thread({ token }: { token: Token }) {
  const { t, connected, toggleConnect } = useApp();
  const comments = commentsFor(token);
  const [text, setText] = useState("");

  return (
    <div className="p-4">
      <div className="flex gap-3">
        <Avatar wallet={token.creator} me />
        <div className="flex-1">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={280} placeholder={t("token.replyPlaceholder")} className="resize-none" />
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted-foreground">{text.length}/280</span>
            <Button
              size="sm"
              disabled={connected && text.trim().length === 0}
              onClick={
                connected
                  ? () => {
                      toast.success(t("token.postReply"));
                      setText("");
                    }
                  : toggleConnect
              }
            >
              <Send /> {connected ? t("token.postReply") : t("common.connect")}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {comments.map((c) => (
          <div key={c.id} className={cn("flex gap-3", c.replyTo && "ml-8")}>
            <Avatar wallet={c.wallet} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono">{shortAddr(c.wallet, 4, 4)}</span>
                {c.isCreator && <Badge variant="gold">{t("token.creatorTag")}</Badge>}
                <span className="text-muted-foreground">
                  <TimeAgo ts={c.time} /> ago
                </span>
                {c.replyTo && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CornerDownRight size={11} /> {shortAddr(token.creator, 4, 4)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-secondary-foreground">{c.text}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                <button className="inline-flex items-center gap-1 hover:text-down">
                  <Heart size={12} /> {c.likes}
                </button>
                <button className="hover:text-foreground">Reply</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Avatar({ wallet, me }: { wallet: string; me?: boolean }) {
  const h1 = parseInt(wallet.slice(2, 5), 16) % 360;
  const h2 = parseInt(wallet.slice(5, 8), 16) % 360;
  return (
    <div
      className={cn("size-8 shrink-0 rounded-full", me && "ring-2 ring-primary/50")}
      style={{ background: `linear-gradient(135deg, hsl(${h1} 70% 50%), hsl(${h2} 70% 35%))` }}
    />
  );
}
