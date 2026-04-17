"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { isoWeekStart, isoWeekEnd, toISODate } from "@/lib/utils";

export function GenerateReportButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period_start: toISODate(isoWeekStart()),
          period_end: toISODate(isoWeekEnd()),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      toast.success("Report generated");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={generate} disabled={busy} className="btn-primary">
      {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
      Generate for this week
    </button>
  );
}
