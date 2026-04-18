"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export async function createBudgetLine(input: {
  projectId: string;
  organisationId: string;
  initiativeId: string;
  year: number;
  quarter: number;
  category: string;
  description: string;
  currency: string;
  plannedAmount: number;
  committedAmount: number;
}) {
  await requireProfile();
  const [row] = await sql`
    INSERT INTO budget_lines (
      organisation_id, project_id, initiative_id, year, quarter,
      category, description, currency, planned_amount, committed_amount
    )
    VALUES (
      ${input.organisationId},
      ${input.projectId},
      ${input.initiativeId || null},
      ${input.year},
      ${input.quarter},
      ${input.category}::budget_category,
      ${input.description},
      ${input.currency},
      ${input.plannedAmount},
      ${input.committedAmount}
    )
    RETURNING id
  `;
  revalidatePath(`/projects/${input.projectId}/budget`);
  return { id: row.id as string };
}
