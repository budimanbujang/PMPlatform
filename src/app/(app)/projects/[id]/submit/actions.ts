"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";

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
  const sb = supabaseServer();

  const due = `${data.periodEnd}T15:00:00+08:00`;

  const { data: row, error } = await sb
    .from("submissions")
    .upsert({
      organisation_id: data.organisationId,
      project_id: data.projectId,
      initiative_id: data.initiativeId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      due_at: due,
      submitted_by: profile.id,
      status: "draft",
      rag: data.rag,
      progress_pct: data.progress_pct ?? null,
      headline: data.headline ?? null,
      progress_notes: data.progress_notes ?? null,
      risks_text: data.risks_text ?? null,
      issues_text: data.issues_text ?? null,
      narrative: data.narrative ?? null,
      escalate: data.escalate ?? false,
      escalate_reason: data.escalate_reason ?? null,
      payload: data.payload ?? {},
    }, { onConflict: "initiative_id,period_start" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: row.id };
}

export async function submitSubmission(id: string) {
  const profile = await requireProfile();
  const sb = supabaseServer();
  const now = new Date();
  const { error } = await sb
    .from("submissions")
    .update({
      status: "submitted",
      submitted_at: now.toISOString(),
      submitted_by: profile.id,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Fire an escalation alert if the user toggled it.
  const { data: s } = await sb.from("submissions")
    .select("id, project_id, organisation_id, escalate, escalate_reason, headline")
    .eq("id", id).single();

  if (s?.escalate) {
    await sb.from("alerts").insert({
      organisation_id: s.organisation_id,
      project_id: s.project_id,
      kind: "escalation",
      severity: "critical",
      title: `Escalation raised: ${s.headline ?? "(no headline)"}`,
      body: s.escalate_reason ?? "",
    });
  }

  revalidatePath(`/projects/${s?.project_id ?? ""}`);
  return { ok: true };
}
