"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProject } from "./actions";

type Opt = { id: string; name: string; is_default?: boolean; portfolio_id?: string | null };

export function ProjectWizard({
  templates, portfolios, programmes,
}: {
  templates: Opt[];
  portfolios: Opt[];
  programmes: Opt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    department: "",
    cadence: "weekly" as "weekly" | "biweekly" | "monthly",
    template_id: templates.find((t) => t.is_default)?.id ?? "",
    portfolio_id: "",
    programme_id: "",
    start_date: "",
    target_end_date: "",
    submission_deadline_dow: 1,
    submission_deadline_time: "15:00",
  });

  const filteredProgrammes = form.portfolio_id
    ? programmes.filter((p) => p.portfolio_id === form.portfolio_id)
    : programmes;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await createProject(form);
      toast.success("Project created");
      router.push(`/projects/${id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="card">
      <div className="card-body space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Project code *</label>
            <input
              className="input"
              required maxLength={32}
              placeholder="e.g. IRIS, FIN-2026-01"
              value={form.code}
              onChange={(e) => update("code", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="label">Name *</label>
            <input
              className="input" required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea className="input min-h-[80px]"
              value={form.description}
              onChange={(e) => update("description", e.target.value)} />
          </div>
          <div>
            <label className="label">Department</label>
            <input className="input"
              placeholder="e.g. Transformation Office"
              value={form.department}
              onChange={(e) => update("department", e.target.value)} />
          </div>
          <div>
            <label className="label">Reporting cadence</label>
            <select className="input" value={form.cadence}
              onChange={(e) => update("cadence", e.target.value as any)}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="label">Submission deadline — day of week</label>
            <select className="input"
              value={form.submission_deadline_dow}
              onChange={(e) => update("submission_deadline_dow", Number(e.target.value))}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
                <option key={d} value={i+1}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Submission deadline — time</label>
            <input type="time" className="input"
              value={form.submission_deadline_time}
              onChange={(e) => update("submission_deadline_time", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Submission template</label>
            <select className="input" value={form.template_id}
              onChange={(e) => update("template_id", e.target.value)}>
              <option value="">Default</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Portfolio</label>
            <select className="input" value={form.portfolio_id}
              onChange={(e) => update("portfolio_id", e.target.value)}>
              <option value="">—</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Programme</label>
            <select className="input" value={form.programme_id}
              onChange={(e) => update("programme_id", e.target.value)}>
              <option value="">—</option>
              {filteredProgrammes.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Start date</label>
            <input type="date" className="input" value={form.start_date}
              onChange={(e) => update("start_date", e.target.value)} />
          </div>
          <div>
            <label className="label">Target end date</label>
            <input type="date" className="input" value={form.target_end_date}
              onChange={(e) => update("target_end_date", e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" className="btn-secondary" onClick={() => history.back()}>Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
