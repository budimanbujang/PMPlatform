"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";

export function ReportDownload({ pdfPath }: { pdfPath: string }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const { data, error } = await supabaseBrowser()
      .storage.from("reports")
      .createSignedUrl(pdfPath, 60 * 10);
    setBusy(false);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Could not load");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <button type="button" onClick={open} className="btn-ghost" disabled={busy}>
      {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
      PDF
    </button>
  );
}
