"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export async function addInitiative(input: {
  projectId: string;
  organisationId: string;
  code: string;
  name: string;
  championId: string;
  sortOrder: number;
}) {
  await requireProfile();
  await sql`
    INSERT INTO initiatives (organisation_id, project_id, code, name, champion_id, sort_order)
    VALUES (
      ${input.organisationId},
      ${input.projectId},
      ${input.code.trim().toUpperCase()},
      ${input.name.trim()},
      ${input.championId || null},
      ${input.sortOrder}
    )
  `;
  revalidatePath(`/projects/${input.projectId}/initiatives`);
}

export async function deleteInitiative(id: string, projectId: string) {
  await requireProfile();
  await sql`DELETE FROM initiatives WHERE id = ${id}`;
  revalidatePath(`/projects/${projectId}/initiatives`);
}

export async function setInitiativeRag(
  id: string,
  rag: "green" | "amber" | "red" | "grey",
  projectId: string,
) {
  await requireProfile();
  await sql`UPDATE initiatives SET rag = ${rag}::project_rag WHERE id = ${id}`;
  revalidatePath(`/projects/${projectId}/initiatives`);
}
