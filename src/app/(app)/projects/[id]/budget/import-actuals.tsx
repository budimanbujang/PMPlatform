"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { FileUp, Download, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importActuals, type ImportActualsReport } from "./actions";

export interface BudgetLineLite {
  id: string;
  description: string;
  initiative_code: string | null;
  year: number;
  quarter: number | null;
}

export function ImportActualsButton({
  projectId,
  budgetLines,
}: {
  projectId: string;
  budgetLines: BudgetLineLite[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary"
      >
        <FileUp className="mr-1.5 h-4 w-4" /> Import actuals
      </button>
      {open && (
        <ImportDialog
          projectId={projectId}
          budgetLines={budgetLines}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ImportDialog({
  projectId,
  budgetLines,
  onClose,
}: {
  projectId: string;
  budgetLines: BudgetLineLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<ImportActualsReport | null>(null);

  // Esc + body scroll lock
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function downloadTemplate() {
    const header = "budget_line_id,description,period_end,amount,reference\n";
    const body = budgetLines
      .map((l) => {
        const desc = l.description.replace(/"/g, '""');
        const tag = `${l.initiative_code ? l.initiative_code + " · " : ""}${l.year}${l.quarter ? " Q" + l.quarter : ""}`;
        return `${l.id},"${desc} (${tag})",,,`;
      })
      .join("\n");
    const blob = new Blob([header + body + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `actuals-template-${projectId.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!csv.trim()) {
      toast.error("Pick a CSV file first.");
      return;
    }
    start(async () => {
      try {
        const r = await importActuals(projectId, csv);
        setReport(r);
        if (r.imported > 0) {
          toast.success(`Imported ${r.imported} row${r.imported === 1 ? "" : "s"}`);
          router.refresh();
        } else {
          toast.info("Nothing imported — see the report for skip reasons.");
        }
      } catch (err: any) {
        toast.error(err?.message ?? "Import failed");
      }
    });
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Import actuals"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-2xl rounded-lg border border-border bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[14px] font-semibold">Import actuals from CSV</h2>
          <button type="button" onClick={onClose} className="btn-ghost text-xs" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2 text-[13px] text-fg2">
            <p>
              After month-end close, drop the actuals CSV here. Each row records a
              real spend against a single budget line.
            </p>
            <p>
              Required columns: <code className="font-mono text-[11px] bg-bg-muted px-1 rounded">
              budget_line_id, period_end (YYYY-MM-DD), amount</code>.
              Optional: <code className="font-mono text-[11px] bg-bg-muted px-1 rounded">reference</code>.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-fg2 hover:bg-bg-muted"
            >
              <Download className="h-3.5 w-3.5" />
              Download template
            </button>
            <p className="mt-1 text-[11px] text-fg3">
              Pre-filled with this project&apos;s {budgetLines.length} budget line ID(s) and
              human-readable labels. Open in Excel, fill the amount + period_end columns, save as CSV.
            </p>
          </div>

          <div>
            <label className="label">Upload filled CSV</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="block w-full text-[13px] text-fg2 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white hover:file:bg-brand-700"
            />
            {fileName && (
              <p className="mt-1 text-[11px] text-fg3">Selected: {fileName}</p>
            )}
          </div>

          {report && (
            <div className="rounded-md border border-border bg-bg-subtle p-3 text-[12px]">
              <div className="font-semibold text-fg1">
                Imported {report.imported} row{report.imported === 1 ? "" : "s"} · total{" "}
                {new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(report.totalAmount)}
              </div>
              {report.skipped.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {report.skipped.length} row(s) skipped
                  </div>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto pl-5 list-disc text-fg3">
                    {report.skipped.map((s, i) => (
                      <li key={i}>row {s.row}: {s.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            {report ? "Close" : "Cancel"}
          </button>
          <button type="submit" className="btn-primary" disabled={pending || !csv}>
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
