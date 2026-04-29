"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  description: z.string().optional().default(""),
  division: z.string().optional().default(""),
  department: z.string().optional().default(""),
  accessMode: z.enum(["public", "restricted"]),
  allowedEntraGroups: z.array(z.string()).default([]),
});

export async function createPortfolio(input: z.infer<typeof createSchema>) {
  const profile = await requireProfile();
  if (!profile.organisation_id) throw new Error("No organisation on your profile");

  const data = createSchema.parse(input);
  const orgId = profile.organisation_id;
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  // Duplicate guard.
  const dup = await sql`
    SELECT id FROM portfolios
    WHERE organisation_id = ${orgId}
      AND (upper(code) = upper(${code}) OR lower(name) = lower(${name}))
    LIMIT 1
  `;
  if (dup.length > 0) {
    throw new Error(`A portfolio with that code or name already exists.`);
  }

  // Restricted with no groups = inaccessible. Force public when empty.
  const accessMode = data.accessMode === "restricted" && data.allowedEntraGroups.length === 0
    ? "public"
    : data.accessMode;

  const [row] = await sql`
    INSERT INTO portfolios (
      organisation_id, code, name, description,
      division, department, access_mode, allowed_entra_groups
    )
    VALUES (
      ${orgId},
      ${code},
      ${name},
      ${data.description || null},
      ${data.division || null},
      ${data.department || null},
      ${accessMode},
      ${data.allowedEntraGroups}
    )
    RETURNING id
  `;
  const id = row.id as string;

  await recordAudit({
    actor: profile,
    action: "portfolio.create",
    entityType: "portfolio",
    entityId: id,
    diff: {
      created: {
        code, name,
        division:    data.division || null,
        department:  data.department || null,
        access_mode: accessMode,
        allowed_entra_groups: data.allowedEntraGroups,
      },
    },
  });

  revalidatePath("/portfolios");
  revalidatePath("/projects");
  return { id };
}

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

export async function updatePortfolio(input: z.infer<typeof updateSchema>) {
  const profile = await requireProfile();
  const { id, ...patch } = updateSchema.parse(input);

  const rows = await sql`SELECT * FROM portfolios WHERE id = ${id} LIMIT 1`;
  const before = rows[0] as any;
  if (!before) throw new Error("Portfolio not found");

  await sql`
    UPDATE portfolios SET
      code        = COALESCE(${patch.code ?? null}, code),
      name        = COALESCE(${patch.name ?? null}, name),
      description = COALESCE(${patch.description ?? null}, description),
      division    = COALESCE(${patch.division ?? null}, division),
      department  = COALESCE(${patch.department ?? null}, department),
      access_mode = COALESCE(${patch.accessMode ?? null}, access_mode),
      allowed_entra_groups =
        COALESCE(${patch.allowedEntraGroups ?? null}::text[], allowed_entra_groups),
      updated_at  = now()
    WHERE id = ${id}
  `;

  await recordAudit({
    actor: profile,
    action: "portfolio.update",
    entityType: "portfolio",
    entityId: id,
    diff: { changes: patch },
  });

  revalidatePath(`/portfolios/${id}`);
  revalidatePath("/portfolios");
}

/**
 * Move an existing project under a portfolio. Used by the "Add existing
 * project" picker on portfolio detail pages.
 */
export async function attachProjectToPortfolio(projectId: string, portfolioId: string) {
  const profile = await requireProfile();

  const beforeRows = await sql`
    SELECT portfolio_id FROM projects
    WHERE id = ${projectId} AND organisation_id = ${profile.organisation_id}
    LIMIT 1
  `;
  const before = beforeRows[0] as any;
  if (!before) throw new Error("Project not found");

  await sql`
    UPDATE projects SET portfolio_id = ${portfolioId}, updated_at = now()
    WHERE id = ${projectId}
  `;

  await recordAudit({
    actor: profile,
    action: "project.move",
    entityType: "project",
    entityId: projectId,
    diff: {
      projectId,
      changes: {
        portfolio_id: { before: before.portfolio_id, after: portfolioId },
      },
    },
  });

  revalidatePath(`/portfolios/${portfolioId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}
