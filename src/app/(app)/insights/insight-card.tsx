"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import type { AiInsight } from "@/types/database";

export function InsightCard({ insight }: { insight: AiInsight }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toneClasses =
    insight.severity === "critical" ? "border-red-300 bg-red-50" :
    insight.severity === "warn"     ? "border-amber-300 bg-amber-50" :
    insight.severity === "notice"   ? "border-blue-200 bg-blue-50" :
                                      "border-slate-200 bg-white";

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
    <div className={`rounded-lg border ${toneClasses} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            {insight.kind.replace("_", " ")} · {insight.severity}
          </div>
          <h3 className="mt-0.5 text-sm font-semibold">{insight.headline}</h3>
        </div>
        {!insight.acknowledged_at && (
          <button onClick={ack} disabled={busy} className="btn-ghost text-xs">
            <Check className="mr-1 h-3 w-3" /> Mark read
          </button>
        )}
      </div>
      {insight.body_md && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{insight.body_md}</p>
      )}
      <div className="mt-3 text-[10px] text-slate-500">{formatDateTime(insight.generated_at)}</div>
    </div>
  );
}
