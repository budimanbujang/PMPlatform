"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
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
  const orgId = profile.organisation_id;
  const name = data.name.trim();
  const code = data.code.trim().toUpperCase();

  // Application-layer duplicate check — gives a friendlier error than the
  // unique index would. The index is still the safety net for races.
  const dupName = await sql`
    SELECT id FROM projects
    WHERE organisation_id = ${orgId} AND lower(name) = lower(${name})
    LIMIT 1
  `;
  if (dupName.length > 0) {
    throw new Error(`A project named "${name}" already exists. Pick a different name.`);
  }
  const dupCode = await sql`
    SELECT id FROM projects
    WHERE organisation_id = ${orgId} AND upper(code) = upper(${code})
    LIMIT 1
  `;
  if (dupCode.length > 0) {
    throw new Error(`A project with code "${code}" already exists. Pick a different code.`);
  }

  const [row] = await sql`
    INSERT INTO projects (
      organisation_id, code, name, description, department, cadence,
      submission_deadline_dow, submission_deadline_time,
      template_id, portfolio_id, programme_id, start_date, target_end_date,
      created_by, status
    )
    VALUES (
      ${orgId},
      ${code},
      ${name},
      ${data.description || null},
      ${data.department || null},
      ${data.cadence},
      ${data.submission_deadline_dow},
      ${data.submission_deadline_time},
      ${data.template_id || null},
      ${data.portfolio_id || null},
      ${data.programme_id || null},
      ${data.start_date || null},
      ${data.target_end_date || null},
      ${profile.id},
      'draft'
    )
    RETURNING id
  `;

  if (!row?.id) throw new Error("Failed to create project");
  const projectId = row.id as string;

  await sql`
    INSERT INTO members (organisation_id, project_id, profile_id, role)
    VALUES (${orgId}, ${projectId}, ${profile.id}, 'pmo')
  `;

  await sql`
    INSERT INTO project_lifecycle_events (project_id, from_status, to_status, actor_id, reason)
    VALUES (${projectId}, NULL, 'draft', ${profile.id}, 'Project registered')
  `;

  return { id: projectId };
}
