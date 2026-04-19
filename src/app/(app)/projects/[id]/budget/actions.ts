"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { recordAudit, buildDiff } from "@/lib/audit";

// =============================================================================
// CSV import for budget actuals
// =============================================================================

export interface ImportActualsRow {
  budget_line_id: string;
  period_end: string;
  amount: number;
  reference?: string | null;
}

export interface ImportActualsReport {
  imported: number;
  skipped: { row: number; reason: string }[];
  totalAmount: number;
}

/**
 * Parse a CSV string of budget actuals and insert valid rows into
 * `budget_actuals`. Caller passes the raw CSV text from a file upload.
 *
 * Expected columns (header required, order flexible, extras ignored):
 *   budget_line_id   uuid of an existing line on this project
 *   period_end       YYYY-MM-DD
 *   amount           number (RM)
 *   reference        free-text invoice/PO ref (optional)
 *
 * Returns a per-import report with successes + per-row skip reasons.
 * Audits one summary entry per import; doesn't audit each row to keep
 * the changelog readable.
 */
export async function importActuals(
  projectId: string,
  csv: string,
): Promise<ImportActualsReport> {
  const profile = await requireProfile();
  if (!profile.organisation_id) throw new Error("No organisation on profile");

  const parsed = parseCsv(csv);
  if (parsed.length === 0) {
    return { imported: 0, skipped: [], totalAmount: 0 };
  }

  // Get the legal set of budget_line_ids for this project so we reject
  // any UUIDs that don't belong to it.
  const legalRows = await sql`
    SELECT id, organisation_id
    FROM budget_lines
    WHERE project_id = ${projectId}
  `;
  const legalIds = new Map<string, string>(
    (legalRows as any[]).map((r) => [r.id, r.organisation_id]),
  );

  const skipped: { row: number; reason: string }[] = [];
  let imported = 0;
  let totalAmount = 0;

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const lineNo = i + 2; // header is row 1
    const lineId   = (row.budget_line_id ?? "").trim();
    const period   = (row.period_end ?? "").trim();
    const amountS  = (row.amount ?? "").toString().replace(/[, ]/g, "").trim();
    const reference = (row.reference ?? "").trim() || null;

    if (!lineId)            { skipped.push({ row: lineNo, reason: "missing budget_line_id" }); continue; }
    if (!legalIds.has(lineId)) { skipped.push({ row: lineNo, reason: "budget_line_id does not belong to this project" }); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) {
      skipped.push({ row: lineNo, reason: "period_end not YYYY-MM-DD" });
      continue;
    }
    const amount = Number(amountS);
    if (!Number.isFinite(amount)) {
      skipped.push({ row: lineNo, reason: "amount not a number" });
      continue;
    }
    if (amount < 0) {
      skipped.push({ row: lineNo, reason: "amount negative" });
      continue;
    }

    const orgId = legalIds.get(lineId)!;
    await sql`
      INSERT INTO budget_actuals (
        organisation_id, budget_line_id, period_end, actual_amount,
        source, reference, recorded_by
      )
      VALUES (
        ${orgId}, ${lineId}, ${period}, ${amount},
        'csv_import', ${reference}, ${profile.id}
      )
    `;
    imported++;
    totalAmount += amount;
  }

  if (imported > 0) {
    await recordAudit({
      actor: profile,
      action: "budget_actuals.import",
      entityType: "project",
      entityId: projectId,
      diff: {
        projectId,
        imported_rows: imported,
        skipped_rows: skipped.length,
        total_amount: totalAmount,
        source: "csv_import",
      },
    });
  }

  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/changelog`);
  revalidatePath("/budget");

  return { imported, skipped, totalAmount };
}

// ---------------------------------------------------------------------------
// Tiny CSV parser — handles quoted fields, escaped quotes, and CRLF.
// Avoids pulling in a dependency for the few-hundred-row payloads we see.
// ---------------------------------------------------------------------------
function parseCsv(input: string): Record<string, string>[] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; continue; }
      if (c === '"') { inQ = false; continue; }
      field += c;
      continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === ",") { cur.push(field); field = ""; continue; }
    if (c === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; continue; }
    field += c;
  }
  cur.push(field);
  lines.push(cur);

  const header = (lines.shift() ?? []).map((h) => h.trim().toLowerCase());
  return lines
    .filter((ln) => ln.some((cell) => cell.trim() !== ""))
    .map((ln) => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => { obj[h] = (ln[idx] ?? "").trim(); });
      return obj;
    });
}

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
