"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export async function closeRisk(riskId: string) {
  await requireProfile();
  await sql`UPDATE risks SET status = 'closed' WHERE id = ${riskId}`;
  revalidatePath("/risks");
}

export async function createRisk(input: {
  projectId: string;
  organisationId: string;
  title: string;
  description: string;
  severity: string;
  likelihood: string;
  mitigation: string;
  ownerId: string;
  nextReviewAt: string;
}) {
  await requireProfile();
  const [row] = await sql`
    INSERT INTO risks (
      organisation_id, project_id, title, description, severity, likelihood,
      mitigation, owner_id, next_review_at
    )
    VALUES (
      ${input.organisationId},
      ${input.projectId},
      ${input.title},
      ${input.description || null},
      ${input.severity}::risk_severity,
      ${input.likelihood}::risk_likelihood,
      ${input.mitigation || null},
      ${input.ownerId || null},
      ${input.nextReviewAt || null}
    )
    RETURNING id
  `;
  revalidatePath(`/projects/${input.projectId}/risks`);
  return { id: row.id as string };
}
