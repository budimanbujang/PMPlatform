"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export async function setDeliverableStatus(
  deliverableId: string,
  status: "in_progress" | "blocked" | "complete" | "not_started" | "cancelled",
) {
  await requireProfile();
  if (status === "complete") {
    await sql`
      UPDATE deliverables
      SET status = ${status}::deliverable_status, completed_at = now()
      WHERE id = ${deliverableId}
    `;
  } else {
    await sql`
      UPDATE deliverables
      SET status = ${status}::deliverable_status, completed_at = NULL
      WHERE id = ${deliverableId}
    `;
  }
  revalidatePath("/deliverables");
}

export async function createDeliverable(input: {
  projectId: string;
  organisationId: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  dueDate: string;
  ownerId: string;
  initiativeId: string;
  milestoneId: string;
}) {
  await requireProfile();
  const [row] = await sql`
    INSERT INTO deliverables (
      organisation_id, project_id, title, description, acceptance_criteria,
      due_date, owner_id, initiative_id, milestone_id
    )
    VALUES (
      ${input.organisationId},
      ${input.projectId},
      ${input.title},
      ${input.description || null},
      ${input.acceptanceCriteria || null},
      ${input.dueDate || null},
      ${input.ownerId || null},
      ${input.initiativeId || null},
      ${input.milestoneId || null}
    )
    RETURNING id
  `;
  revalidatePath(`/projects/${input.projectId}/deliverables`);
  return { id: row.id as string };
}
