// =============================================================================
// Audit log helper — one call per state-changing server action.
// Records actor, action, entity reference, and a structured diff.
// Rows land in the `audit_log` table defined in Phase 4 of the schema.
// =============================================================================

import { sql } from "@/lib/db";
import type { Profile } from "@/types/database";

export type AuditAction =
  | "budget_line.create"
  | "budget_line.update"
  | "budget_line.delete"
  | "risk.create"
  | "risk.update"
  | "risk.close"
  | "deliverable.create"
  | "deliverable.status"
  | "project.create"
  | "project.update"
  | "member.add"
  | "member.remove"
  | "initiative.create"
  | "initiative.delete"
  | "initiative.rag"
  | (string & {});

export interface AuditInput {
  actor: Pick<Profile, "id" | "email" | "organisation_id">;
  action: AuditAction;
  entityType: string;         // e.g. "budget_line"
  entityId: string | null;    // nullable for "delete" where we no longer have an id
  // `diff` is stored as JSONB. Convention:
  //   { projectId: "…", changes: { field: { before, after } } }
  // projectId lets the per-project Changelog tab filter efficiently.
  diff?: Record<string, unknown>;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const diffJson = input.diff ? JSON.stringify(input.diff) : null;
  await sql`
    INSERT INTO audit_log (
      organisation_id, actor_id, actor_email, action,
      entity_type, entity_id, diff
    )
    VALUES (
      ${input.actor.organisation_id},
      ${input.actor.id},
      ${input.actor.email},
      ${input.action},
      ${input.entityType},
      ${input.entityId},
      ${diffJson}::jsonb
    )
  `;
}

/**
 * Builds a `{ field: { before, after } }` diff object. Skips unchanged
 * values. Normalises empty strings / undefined / null to null for
 * comparison so minor input quirks don't produce noise.
 */
export function buildDiff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: (keyof T)[],
): Record<string, { before: unknown; after: unknown }> {
  const out: Record<string, { before: unknown; after: unknown }> = {};
  const norm = (v: unknown) =>
    v === "" || v === undefined ? null : typeof v === "number" ? String(v) : v;
  for (const k of keys) {
    if (norm(before[k]) !== norm(after[k])) {
      out[String(k)] = { before: before[k] ?? null, after: after[k] ?? null };
    }
  }
  return out;
}
