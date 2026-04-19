"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { updateBudgetLine, deleteBudgetLine } from "./actions";

export interface BudgetRow {
  id: string;
  description: string;
  initiative_id: string | null;
  year: number;
  quarter: number | null;
  category: string;
  currency: string;
  planned_amount: number;
  committed_amount: number;
}

export interface Initiative {
  id: string;
  code: string;
  name: string;
}

export function BudgetRowActions({
  projectId,
  row,
  initiatives,
}: {
  projectId: string;
  row: BudgetRow;
  initiatives: Initiative[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="btn-ghost text-xs"
        aria-label={`Edit ${row.description}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {open && (
        <EditDialog
          projectId={projectId}
          row={row}
          initiatives={initiatives}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function EditDialog({
  projectId, row, initiatives, onClose,
}: {
  projectId: string;
  row: BudgetRow;
  initiatives: Initiative[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    description: row.description,
    initiative_id: row.initiative_id ?? "",
    year: row.year,
    quarter: row.quarter ?? 1,
    category: row.category,
    currency: row.currency,
    planned_amount: row.planned_amount,
    committed_amount: row.committed_amount,
  });

  // Close on Esc, restore focus on unmount.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const u = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await updateBudgetLine({
          id: row.id,
          projectId,
          description: form.description,
          initiativeId: form.initiative_id,
          year: Number(form.year),
          quarter: Number(form.quarter),
          category: form.category,
          currency: form.currency,
          plannedAmount: Number(form.planned_amount),
          committedAmount: Number(form.committed_amount),
        });
        toast.success("Budget line updated");
        onClose();
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to update");
      }
    });
  }

  function remove() {
    if (!confirm("Delete this budget line? This cannot be undone.")) return;
    start(async () => {
      try {
        await deleteBudgetLine(row.id, projectId);
        toast.success("Budget line deleted");
        onClose();
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to delete");
      }
    });
  }

  // Portal the dialog onto <body> so card click-handlers / z-index stacking
  // in the table don't interfere.
  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit budget line"
    >
      <form
        onSubmit={save}
        className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[14px] font-semibold">Edit budget line</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost text-xs"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Description *</label>
            <input className="input" required value={form.description}
              onChange={(e) => u("description", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Initiative</label>
            <select className="input" value={form.initiative_id}
              onChange={(e) => u("initiative_id", e.target.value)}>
              <option value="">Project-level</option>
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>{i.code} · {i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category}
              onChange={(e) => u("category", e.target.value)}>
              {["capex","opex","vendor","licensing","people","contingency","other"].map((c) =>
                <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input" value={form.currency}
              onChange={(e) => u("currency", e.target.value)}>
              <option>MYR</option><option>USD</option><option>SGD</option>
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input" value={form.year}
              onChange={(e) => u("year", Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Quarter</label>
            <select className="input" value={form.quarter}
              onChange={(e) => u("quarter", Number(e.target.value))}>
              {[1,2,3,4].map((q) => <option key={q} value={q}>Q{q}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Planned amount</label>
            <input type="number" step="0.01" className="input" value={form.planned_amount}
              onChange={(e) => u("planned_amount", Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Committed amount</label>
            <input type="number" step="0.01" className="input" value={form.committed_amount}
              onChange={(e) => u("committed_amount", Number(e.target.value))} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
