"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { recordAudit, buildDiff } from "@/lib/audit";

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
  const profile = await requireProfile();
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
  const id = row.id as string;

  await recordAudit({
    actor: profile,
    action: "budget_line.create",
    entityType: "budget_line",
    entityId: id,
    diff: {
      projectId: input.projectId,
      created: {
        description:      input.description,
        initiative_id:    input.initiativeId || null,
        year:             input.year,
        quarter:          input.quarter,
        category:         input.category,
        currency:         input.currency,
        planned_amount:   input.plannedAmount,
        committed_amount: input.committedAmount,
      },
    },
  });

  revalidatePath(`/projects/${input.projectId}/budget`);
  revalidatePath(`/projects/${input.projectId}/changelog`);
  return { id };
}

export async function updateBudgetLine(input: {
  id: string;
  projectId: string;
  description: string;
  initiativeId: string;
  year: number;
  quarter: number;
  category: string;
  currency: string;
  plannedAmount: number;
  committedAmount: number;
}) {
  const profile = await requireProfile();

  // Load existing row so we can compute what actually changed.
  const rows = await sql`SELECT * FROM budget_lines WHERE id = ${input.id} LIMIT 1`;
  const current = rows[0] as any;
  if (!current) throw new Error("Budget line not found");

  const before = {
    description:      current.description,
    initiative_id:    current.initiative_id,
    year:             current.year,
    quarter:          current.quarter,
    category:         current.category,
    currency:         current.currency,
    planned_amount:   Number(current.planned_amount),
    committed_amount: Number(current.committed_amount),
  };
  const after = {
    description:      input.description,
    initiative_id:    input.initiativeId || null,
    year:             input.year,
    quarter:          input.quarter,
    category:         input.category,
    currency:         input.currency,
    planned_amount:   input.plannedAmount,
    committed_amount: input.committedAmount,
  };

  const changes = buildDiff(before, after, Object.keys(before) as (keyof typeof before)[]);

  await sql`
    UPDATE budget_lines
    SET description       = ${input.description},
        initiative_id     = ${input.initiativeId || null},
        year              = ${input.year},
        quarter           = ${input.quarter},
        category          = ${input.category}::budget_category,
        currency          = ${input.currency},
        planned_amount    = ${input.plannedAmount},
        committed_amount  = ${input.committedAmount},
        updated_at        = now()
    WHERE id = ${input.id}
  `;

  if (Object.keys(changes).length > 0) {
    await recordAudit({
      actor: profile,
      action: "budget_line.update",
      entityType: "budget_line",
      entityId: input.id,
      diff: { projectId: input.projectId, changes },
    });
  }

  revalidatePath(`/projects/${input.projectId}/budget`);
  revalidatePath(`/projects/${input.projectId}/changelog`);
}

export async function deleteBudgetLine(id: string, projectId: string) {
  const profile = await requireProfile();

  const rows = await sql`SELECT description FROM budget_lines WHERE id = ${id} LIMIT 1`;
  const deletedDescription = (rows[0] as any)?.description ?? null;

  await sql`DELETE FROM budget_lines WHERE id = ${id}`;

  await recordAudit({
    actor: profile,
    action: "budget_line.delete",
    entityType: "budget_line",
    entityId: id,
    diff: { projectId, deleted: { description: deletedDescription } },
  });

  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}/changelog`);
}
