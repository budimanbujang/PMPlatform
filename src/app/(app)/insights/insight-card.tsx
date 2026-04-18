"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDateTime } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import type { AiInsight } from "@/types/database";
import { acknowledgeInsight } from "./actions";

const toneClass: Record<AiInsight["severity"], string> = {
  critical: "insight-critical",
  warn:     "insight-warn",
  notice:   "insight-notice",
  info:     "insight-info",
};

export function InsightCard({ insight }: { insight: AiInsight }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function ack() {
    start(async () => {
      try {
        await acknowledgeInsight(insight.id);
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed");
      }
    });
  }

  return (
    <div className={cn("insight", toneClass[insight.severity])}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow text-current opacity-70">
            {insight.kind.replace("_", " ")} · {insight.severity}
          </div>
          <h3 className="mt-0.5 text-[13px] font-semibold leading-snug">{insight.headline}</h3>
        </div>
        {!insight.acknowledged_at && (
          <button
            onClick={ack}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-current opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Check className="h-3 w-3" /> Mark read
          </button>
        )}
      </div>
      {insight.body_md && (
        <div className="mt-2 opacity-90">
          <Markdown>{insight.body_md}</Markdown>
        </div>
      )}
      <div className="mt-2.5 text-[10px] opacity-60">{formatDateTime(insight.generated_at)}</div>
    </div>
  );
}
