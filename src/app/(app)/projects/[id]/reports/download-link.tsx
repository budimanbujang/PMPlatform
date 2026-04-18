"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getReportDownloadUrl } from "./actions";

export function ReportDownload({ pdfPath }: { pdfPath: string }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const url = await getReportDownloadUrl(pdfPath);
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={open} className="btn-ghost" disabled={busy}>
      {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
      PDF
    </button>
  );
}
