"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBudgetLine } from "../actions";

interface Props {
  projectId: string;
  organisationId: string;
  initiatives: { id: string; code: string; name: string }[];
}

export function BudgetForm(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    description: "",
    initiative_id: "",
    year: new Date().getFullYear(),
    quarter: 1,
    category: "opex" as const,
    currency: "MYR",
    planned_amount: 0,
    committed_amount: 0,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createBudgetLine({
        projectId: p.projectId,
        organisationId: p.organisationId,
        initiativeId: form.initiative_id,
        year: form.year,
        quarter: form.quarter,
        category: form.category,
        description: form.description,
        currency: form.currency,
        plannedAmount: form.planned_amount,
        committedAmount: form.committed_amount,
      });
      toast.success("Line added");
      router.push(`/projects/${p.projectId}/budget`);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  const u = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="card">
      <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Description *</label>
          <input className="input" required value={form.description} onChange={(e) => u("description", e.target.value)} />
        </div>
        <div>
          <label className="label">Initiative</label>
          <select className="input" value={form.initiative_id} onChange={(e) => u("initiative_id", e.target.value)}>
            <option value="">Project-level</option>
            {p.initiatives.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category} onChange={(e) => u("category", e.target.value)}>
            {["capex","opex","vendor","licensing","people","contingency","other"].map((c) =>
              <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <input type="number" className="input" value={form.year} onChange={(e) => u("year", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Quarter</label>
          <select className="input" value={form.quarter} onChange={(e) => u("quarter", Number(e.target.value))}>
            {[1,2,3,4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Currency</label>
          <select className="input" value={form.currency} onChange={(e) => u("currency", e.target.value)}>
            <option>MYR</option><option>USD</option><option>SGD</option>
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
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Add line"}</button>
      </div>
    </form>
  );
}
