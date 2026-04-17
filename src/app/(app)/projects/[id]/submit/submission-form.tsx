"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  Initiative, Project, ProjectRag, Submission, SubmissionTemplate, DocumentTag,
} from "@/types/database";
import { saveSubmission, submitSubmission } from "./actions";

interface Props {
  project: Project;
  template: SubmissionTemplate;
  initiatives: Initiative[];
  initiativeId?: string;
  periodStart: string;
  periodEnd: string;
  existing: Submission | null;
  profileId: string;
}

type Tag = DocumentTag;

export function SubmissionForm(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [initiativeId, setInitiativeId] = useState(props.initiativeId ?? props.initiatives[0]?.id);
  const [form, setForm] = useState<Partial<Submission>>(() => ({
    rag: (props.existing?.rag ?? "amber") as ProjectRag,
    progress_pct: props.existing?.progress_pct ?? 0,
    headline: props.existing?.headline ?? "",
    progress_notes: props.existing?.progress_notes ?? "",
    risks_text: props.existing?.risks_text ?? "",
    issues_text: props.existing?.issues_text ?? "",
    narrative: props.existing?.narrative ?? "",
    escalate: props.existing?.escalate ?? false,
    escalate_reason: props.existing?.escalate_reason ?? "",
    payload: props.existing?.payload ?? {},
  }));
  const [files, setFiles] = useState<Array<{ file: File; tag: Tag; description: string }>>([]);

  const modules = useMemo(() => props.template.modules ?? [], [props.template]);

  const update = <K extends keyof Submission>(k: K, v: Submission[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function addFiles(list: FileList | null) {
    if (!list) return;
    const rejected: string[] = [];
    const accepted: typeof files = [];
    Array.from(list).forEach((f) => {
      if (f.size > 10 * 1024 * 1024) rejected.push(f.name);
      else accepted.push({ file: f, tag: "evidence", description: "" });
    });
    if (rejected.length) toast.error(`Too large (>10MB): ${rejected.join(", ")}`);
    setFiles((prev) => [...prev, ...accepted]);
  }

  async function doSave(status: "draft" | "submitted") {
    if (!initiativeId) return toast.error("Pick an initiative");
    setBusy(true);
    try {
      const saved = await saveSubmission({
        projectId: props.project.id,
        initiativeId,
        periodStart: props.periodStart,
        periodEnd: props.periodEnd,
        organisationId: props.project.organisation_id,
        ...form,
      });

      if (files.length) {
        const sb = supabaseBrowser();
        for (const { file, tag, description } of files) {
          const path = `${props.project.organisation_id}/${props.project.id}/${saved.id}/${Date.now()}-${file.name}`;
          const up = await sb.storage.from("project-documents").upload(path, file, {
            cacheControl: "3600", upsert: false,
          });
          if (up.error) {
            toast.error(`Upload failed: ${file.name} — ${up.error.message}`);
            continue;
          }
          await sb.from("documents").insert({
            organisation_id: props.project.organisation_id,
            project_id: props.project.id,
            initiative_id: initiativeId,
            submission_id: saved.id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            tag,
            description: description || null,
            uploaded_by: props.profileId,
          });
        }
      }

      if (status === "submitted") {
        await submitSubmission(saved.id);
        toast.success("Submitted — TMO will collate on Tuesday.");
      } else {
        toast.success("Draft saved.");
      }
      router.refresh();
      router.push(`/projects/${props.project.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); doSave("submitted"); }}
    >
      {/* --- Initiative selector + period --- */}
      <section className="card">
        <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="label">Initiative</label>
            <select
              className="input" required
              value={initiativeId}
              onChange={(e) => setInitiativeId(e.target.value)}
            >
              {props.initiatives.map((i) => (
                <option key={i.id} value={i.id}>{i.code} · {i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reporting period</label>
            <div className="input bg-slate-50">{props.periodStart} → {props.periodEnd}</div>
          </div>
        </div>
      </section>

      {/* Module: Progress & Status */}
      {hasModule(modules, "progress") && (
        <section className="card">
          <div className="card-header"><h2 className="font-semibold">Progress & Status</h2></div>
          <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">RAG *</label>
              <select className="input" required
                value={form.rag as string}
                onChange={(e) => update("rag", e.target.value as ProjectRag)}>
                <option value="green">Green — on track</option>
                <option value="amber">Amber — at risk</option>
                <option value="red">Red — blocked</option>
                <option value="grey">Grey — pending</option>
              </select>
            </div>
            <div>
              <label className="label">Completion %</label>
              <input type="number" min={0} max={100} className="input"
                value={form.progress_pct ?? 0}
                onChange={(e) => update("progress_pct", Number(e.target.value))} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Headline *</label>
              <input type="text" className="input" required maxLength={140}
                placeholder="One sentence your exec will read."
                value={form.headline ?? ""}
                onChange={(e) => update("headline", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Progress notes *</label>
              <textarea className="input min-h-[100px]" required
                placeholder="What shipped this week, what's next week."
                value={form.progress_notes ?? ""}
                onChange={(e) => update("progress_notes", e.target.value)} />
            </div>
          </div>
        </section>
      )}

      {/* Module: Risks & Issues */}
      {hasModule(modules, "risks") && (
        <section className="card">
          <div className="card-header"><h2 className="font-semibold">Risks & Issues</h2></div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Active risks this week</label>
              <textarea className="input min-h-[80px]"
                value={form.risks_text ?? ""}
                onChange={(e) => update("risks_text", e.target.value)} />
            </div>
            <div>
              <label className="label">Open issues this week</label>
              <textarea className="input min-h-[80px]"
                value={form.issues_text ?? ""}
                onChange={(e) => update("issues_text", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox"
                checked={!!form.escalate}
                onChange={(e) => update("escalate", e.target.checked)} />
              <span className="font-medium">Escalate to TMO immediately</span>
            </label>
            {form.escalate && (
              <div>
                <label className="label">Reason for escalation</label>
                <textarea className="input min-h-[60px]" required
                  value={form.escalate_reason ?? ""}
                  onChange={(e) => update("escalate_reason", e.target.value)} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Module: Documents */}
      {hasModule(modules, "documents") && (
        <section className="card">
          <div className="card-header"><h2 className="font-semibold">Evidence & Deliverables</h2></div>
          <div className="card-body">
            <label className="flex items-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 cursor-pointer hover:bg-slate-100">
              <Upload className="h-5 w-5 text-slate-500" />
              <span className="text-sm text-slate-700">Click to choose files (≤10MB each)</span>
              <input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </label>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
                    <div className="flex-1 truncate text-sm">
                      <div className="font-medium truncate">{f.file.name}</div>
                      <div className="text-xs text-slate-500">
                        {(f.file.size / 1024).toFixed(0)} KB · {f.file.type || "—"}
                      </div>
                    </div>
                    <select
                      className="input w-auto"
                      value={f.tag}
                      onChange={(e) => setFiles((prev) =>
                        prev.map((x, i) => i === idx ? { ...x, tag: e.target.value as Tag } : x))}
                    >
                      <option value="evidence">Evidence</option>
                      <option value="deliverable">Deliverable</option>
                      <option value="reference">Reference</option>
                      <option value="other">Other</option>
                    </select>
                    <button type="button" className="btn-ghost"
                      onClick={() => setFiles((p) => p.filter((_, i) => i !== idx))}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Module: Narrative */}
      {hasModule(modules, "narrative") && (
        <section className="card">
          <div className="card-header"><h2 className="font-semibold">Narrative</h2></div>
          <div className="card-body">
            <label className="label">Anything else the TMO should know?</label>
            <textarea className="input min-h-[120px]"
              value={form.narrative ?? ""}
              onChange={(e) => update("narrative", e.target.value)} />
          </div>
        </section>
      )}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => doSave("draft")} disabled={busy} className="btn-secondary">
          Save draft
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Submitting…" : "Submit update"}
        </button>
      </div>
    </form>
  );
}

function hasModule(mods: SubmissionTemplate["modules"], key: string) {
  return mods.some((m) => m.key === key);
}
