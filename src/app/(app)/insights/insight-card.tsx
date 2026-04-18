"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, formatDateTime } from "@/lib/utils";
import type { AiInsight } from "@/types/database";

const toneClass: Record<AiInsight["severity"], string> = {
  critical: "insight-critical",
  warn:     "insight-warn",
  notice:   "insight-notice",
  info:     "insight-info",
};

export function InsightCard({ insight }: { insight: AiInsight }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function ack() {
    setBusy(true);
    const { data: { user } } = await supabaseBrowser().auth.getUser();
    const { error } = await supabaseBrowser().from("ai_insights").update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: user?.id,
    }).eq("id", insight.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    router.refresh();
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
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-current opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Check className="h-3 w-3" /> Mark read
          </button>
        )}
      </div>
      {insight.body_md && (
        <p className="mt-2 whitespace-pre-wrap text-[12px] leading-[1.5] opacity-90">{insight.body_md}</p>
      )}
      <div className="mt-2.5 text-[10px] opacity-60">{formatDateTime(insight.generated_at)}</div>
    </div>
  );
}
