"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Props {
  projectId: string;
  organisationId: string;
  owners: { profile_id: string; name: string }[];
}

export function RiskForm(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "medium" as const,
    likelihood: "possible" as const,
    mitigation: "",
    owner_id: "",
    next_review_at: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser().from("risks").insert({
      organisation_id: p.organisationId,
      project_id: p.projectId,
      title: form.title,
      description: form.description || null,
      severity: form.severity,
      likelihood: form.likelihood,
      mitigation: form.mitigation || null,
      owner_id: form.owner_id || null,
      next_review_at: form.next_review_at || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Risk added");
    router.push(`/projects/${p.projectId}/risks`);
    router.refresh();
  }

  const u = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="card">
      <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Risk title *</label>
          <input className="input" required value={form.title} onChange={(e) => u("title", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => u("description", e.target.value)} />
        </div>
        <div>
          <label className="label">Severity</label>
          <select className="input" value={form.severity} onChange={(e) => u("severity", e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className="label">Likelihood</label>
          <select className="input" value={form.likelihood} onChange={(e) => u("likelihood", e.target.value)}>
            <option value="rare">Rare</option>
            <option value="unlikely">Unlikely</option>
            <option value="possible">Possible</option>
            <option value="likely">Likely</option>
            <option value="almost_certain">Almost certain</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Mitigation</label>
          <textarea className="input min-h-[80px]" value={form.mitigation} onChange={(e) => u("mitigation", e.target.value)} />
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input" value={form.owner_id} onChange={(e) => u("owner_id", e.target.value)}>
            <option value="">—</option>
            {p.owners.map((m) => <option key={m.profile_id} value={m.profile_id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Next review</label>
          <input type="date" className="input" value={form.next_review_at} onChange={(e) => u("next_review_at", e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Log risk"}</button>
      </div>
    </form>
  );
}
