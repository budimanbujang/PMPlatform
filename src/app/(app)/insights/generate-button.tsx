"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { WormLoader } from "@/components/ui/worm-loader";

export function GenerateInsightsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/insights/generate", { method: "POST" });

      // Response might not be JSON (e.g. on a 500 HTML error page). Read as
      // text first, then try JSON, so the toast shows the real cause rather
      // than "Unexpected end of JSON input".
      const raw = await res.text();
      let body: any = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { /* leave as text */ }

      if (!res.ok) {
        const msg = body?.error ?? (raw || `Request failed with status ${res.status}`);
        throw new Error(msg);
      }

      const count = body?.count ?? 0;
      if (count === 0) {
        toast.info(body?.note ?? "No new insights this run.");
      } else {
        toast.success(`Generated ${count} insight${count === 1 ? "" : "s"}`);
      }
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="btn-primary"
      aria-busy={busy}
    >
      {busy ? (
        <WormLoader className="mr-1.5" />
      ) : (
        <Sparkles className="mr-1.5 h-4 w-4" />
      )}
      {busy ? "Generating…" : "Generate now"}
    </button>
  );
}
