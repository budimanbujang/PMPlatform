"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { uploadBlob } from "@/lib/storage/azure-blob";

const saveSchema = z.object({
  projectId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  organisationId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  rag: z.enum(["green", "amber", "red", "grey"]).optional(),
  progress_pct: z.number().int().min(0).max(100).nullable().optional(),
  headline: z.string().nullable().optional(),
  progress_notes: z.string().nullable().optional(),
  risks_text: z.string().nullable().optional(),
  issues_text: z.string().nullable().optional(),
  narrative: z.string().nullable().optional(),
  escalate: z.boolean().optional(),
  escalate_reason: z.string().nullable().optional(),
  payload: z.record(z.unknown()).optional(),
});

export async function saveSubmission(input: z.infer<typeof saveSchema>) {
  const profile = await requireProfile();
  const data = saveSchema.parse(input);
  const due = `${data.periodEnd}T15:00:00+08:00`;

  const [row] = await sql`
    INSERT INTO submissions (
      organisation_id, project_id, initiative_id,
      period_start, period_end, due_at,
      submitted_by, status, rag, progress_pct,
      headline, progress_notes, risks_text, issues_text,
      narrative, escalate, escalate_reason, payload
    )
    VALUES (
      ${data.organisationId}, ${data.projectId}, ${data.initiativeId},
      ${data.periodStart}, ${data.periodEnd}, ${due},
      ${profile.id}, 'draft', ${data.rag ?? 'grey'}::project_rag, ${data.progress_pct ?? null},
      ${data.headline ?? null}, ${data.progress_notes ?? null},
      ${data.risks_text ?? null}, ${data.issues_text ?? null},
      ${data.narrative ?? null}, ${data.escalate ?? false}, ${data.escalate_reason ?? null},
      ${JSON.stringify(data.payload ?? {})}::jsonb
    )
    ON CONFLICT (initiative_id, period_start) DO UPDATE SET
      due_at           = EXCLUDED.due_at,
      submitted_by     = EXCLUDED.submitted_by,
      rag              = EXCLUDED.rag,
      progress_pct     = EXCLUDED.progress_pct,
      headline         = EXCLUDED.headline,
      progress_notes   = EXCLUDED.progress_notes,
      risks_text       = EXCLUDED.risks_text,
      issues_text      = EXCLUDED.issues_text,
      narrative        = EXCLUDED.narrative,
      escalate         = EXCLUDED.escalate,
      escalate_reason  = EXCLUDED.escalate_reason,
      payload          = EXCLUDED.payload,
      updated_at       = now()
    RETURNING id
  `;
  return { id: row.id as string };
}

export async function submitSubmission(id: string) {
  const profile = await requireProfile();

  await sql`
    UPDATE submissions
    SET status = 'submitted', submitted_at = now(), submitted_by = ${profile.id}
    WHERE id = ${id}
  `;

  const rows = await sql`
    SELECT id, project_id, organisation_id, escalate, escalate_reason, headline
    FROM submissions WHERE id = ${id} LIMIT 1
  `;
  const s = rows[0] as any;

  if (s?.escalate) {
    await sql`
      INSERT INTO alerts (organisation_id, project_id, kind, severity, title, body)
      VALUES (
        ${s.organisation_id}, ${s.project_id}, 'escalation', 'critical',
        ${`Escalation raised: ${s.headline ?? "(no headline)"}`},
        ${s.escalate_reason ?? ""}
      )
    `;
  }

  revalidatePath(`/projects/${s?.project_id ?? ""}`);
  return { ok: true };
}

// File upload — called from the submission form (client → server action).
// Uploads the file to Azure Blob Storage, then records the documents row.
export async function uploadSubmissionDocument(formData: FormData) {
  const profile = await requireProfile();

  const file           = formData.get("file") as File | null;
  const submissionId   = formData.get("submissionId") as string;
  const projectId      = formData.get("projectId") as string;
  const initiativeId   = formData.get("initiativeId") as string;
  const organisationId = formData.get("organisationId") as string;
  const tag            = (formData.get("tag") as string) ?? "other";
  const description    = (formData.get("description") as string) ?? "";

  if (!file) throw new Error("Missing file");
  if (file.size > 10 * 1024 * 1024) throw new Error(`Too large: ${file.name}`);

  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${organisationId}/${projectId}/${submissionId}/${Date.now()}-${file.name}`;

  await uploadBlob({
    which: "docs",
    path,
    data: buf,
    contentType: file.type || "application/octet-stream",
  });

  await sql`
    INSERT INTO documents (
      organisation_id, project_id, initiative_id, submission_id,
      storage_path, file_name, mime_type, size_bytes, tag, description, uploaded_by
    )
    VALUES (
      ${organisationId}, ${projectId}, ${initiativeId || null}, ${submissionId},
      ${path}, ${file.name}, ${file.type || null}, ${file.size},
      ${tag}::document_tag, ${description || null}, ${profile.id}
    )
  `;

  return { path };
}
