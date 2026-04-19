"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";

/**
 * Delete a project. Platform-admin only. Cascades through the schema
 * (initiatives, members, submissions, deliverables, milestones, risks,
 * budget_lines, budget_actuals, documents, report_runs, alerts, …) via
 * the existing ON DELETE CASCADE FKs. Logs the deletion to audit_log
 * with the captured name + code so the row is meaningful even after
 * the project is gone.
 */
export async function deleteProject(projectId: string) {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) {
    throw new Error("Only platform administrators can delete projects.");
  }

  const rows = await sql`
    SELECT name, code, organisation_id
    FROM projects
    WHERE id = ${projectId} AND organisation_id = ${profile.organisation_id}
    LIMIT 1
  `;
  const proj = rows[0] as any;
  if (!proj) throw new Error("Project not found");

  await sql`DELETE FROM projects WHERE id = ${projectId}`;

  await recordAudit({
    actor: profile,
    action: "project.delete",
    entityType: "project",
    entityId: projectId,
    diff: { deleted: { name: proj.name, code: proj.code } },
  });

  revalidatePath("/projects");
  revalidatePath("/admin/audit");
}
