"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";

const schema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  description: z.string().optional().default(""),
  department: z.string().optional().default(""),
  cadence: z.enum(["weekly", "biweekly", "monthly"]),
  template_id: z.string().uuid().optional().or(z.literal("")),
  portfolio_id: z.string().uuid().optional().or(z.literal("")),
  programme_id: z.string().uuid().optional().or(z.literal("")),
  start_date: z.string().optional().default(""),
  target_end_date: z.string().optional().default(""),
  submission_deadline_dow: z.number().int().min(1).max(7),
  submission_deadline_time: z.string(),
});

export async function createProject(input: z.infer<typeof schema>) {
  const profile = await requireProfile();
  if (!profile.organisation_id) throw new Error("No organisation assigned to your profile");

  const data = schema.parse(input);
  const sb = supabaseServer();

  const insertPayload: Record<string, unknown> = {
    organisation_id: profile.organisation_id,
    code: data.code.trim().toUpperCase(),
    name: data.name.trim(),
    description: data.description || null,
    department: data.department || null,
    cadence: data.cadence,
    submission_deadline_dow: data.submission_deadline_dow,
    submission_deadline_time: data.submission_deadline_time,
    created_by: profile.id,
    status: "draft",
  };
  if (data.template_id)  insertPayload.template_id  = data.template_id;
  if (data.portfolio_id) insertPayload.portfolio_id = data.portfolio_id;
  if (data.programme_id) insertPayload.programme_id = data.programme_id;
  if (data.start_date)   insertPayload.start_date   = data.start_date;
  if (data.target_end_date) insertPayload.target_end_date = data.target_end_date;

  const { data: row, error } = await sb
    .from("projects")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await sb.from("members").insert({
    organisation_id: profile.organisation_id,
    project_id: row.id,
    profile_id: profile.id,
    role: "pmo",
  });

  await sb.from("project_lifecycle_events").insert({
    project_id: row.id,
    from_status: null,
    to_status: "draft",
    actor_id: profile.id,
    reason: "Project registered",
  });

  return { id: row.id };
}
