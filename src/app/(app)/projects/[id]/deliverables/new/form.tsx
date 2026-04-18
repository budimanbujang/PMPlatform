"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createDeliverable } from "../actions";

interface Props {
  projectId: string;
  organisationId: string;
  initiatives: { id: string; code: string; name: string }[];
  milestones: { id: string; name: string; target_date: string }[];
  members: { profile_id: string; name: string }[];
}

export function DeliverableForm(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    acceptance_criteria: "",
    due_date: "",
    owner_id: "",
    initiative_id: "",
    milestone_id: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createDeliverable({
        projectId: p.projectId,
        organisationId: p.organisationId,
        title: form.title,
        description: form.description,
        acceptanceCriteria: form.acceptance_criteria,
        dueDate: form.due_date,
        ownerId: form.owner_id,
        initiativeId: form.initiative_id,
        milestoneId: form.milestone_id,
      });
      toast.success("Deliverable created");
      router.push(`/projects/${p.projectId}/deliverables`);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  const u = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="card">
      <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Title *</label>
          <input className="input" required value={form.title} onChange={(e) => u("title", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => u("description", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Acceptance criteria</label>
          <textarea className="input min-h-[80px]" value={form.acceptance_criteria} onChange={(e) => u("acceptance_criteria", e.target.value)} />
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input" value={form.owner_id} onChange={(e) => u("owner_id", e.target.value)}>
            <option value="">—</option>
            {p.members.map((m) => <option key={m.profile_id} value={m.profile_id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Due date</label>
          <input type="date" className="input" value={form.due_date} onChange={(e) => u("due_date", e.target.value)} />
        </div>
        <div>
          <label className="label">Initiative</label>
          <select className="input" value={form.initiative_id} onChange={(e) => u("initiative_id", e.target.value)}>
            <option value="">—</option>
            {p.initiatives.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Milestone</label>
          <select className="input" value={form.milestone_id} onChange={(e) => u("milestone_id", e.target.value)}>
            <option value="">—</option>
            {p.milestones.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.target_date})</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Create deliverable"}</button>
      </div>
    </form>
  );
}
