import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { AuditTable, type AuditEntry } from "@/components/ui/audit-table";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { entity?: string; actor?: string };
}) {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) redirect("/");

  const entityFilter = searchParams.entity ?? "";
  const actorFilter  = searchParams.actor ?? "";

  const rows = (await sql`
    SELECT
      a.id, a.at, a.action, a.entity_type, a.entity_id, a.diff,
      p.full_name AS actor_name, p.email AS actor_email
    FROM audit_log a
    LEFT JOIN profiles p ON p.id = a.actor_id
    WHERE a.organisation_id = ${profile.organisation_id}
      AND (${entityFilter || null}::text IS NULL OR a.entity_type = ${entityFilter || null})
      AND (${actorFilter  || null}::text IS NULL OR lower(a.actor_email) LIKE ${"%" + actorFilter.toLowerCase() + "%"})
    ORDER BY a.at DESC
    LIMIT 500
  `) as unknown as AuditEntry[];

  // Distinct entity types in org for the filter dropdown
  const entityTypes = (await sql`
    SELECT DISTINCT entity_type
    FROM audit_log
    WHERE organisation_id = ${profile.organisation_id}
    ORDER BY entity_type
  `) as unknown as { entity_type: string }[];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change made across the platform, by whom and when. Critical for governance and control."
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <select name="entity" className="input w-auto" defaultValue={entityFilter}>
          <option value="">All entities</option>
          {entityTypes.map((e) => (
            <option key={e.entity_type} value={e.entity_type}>{e.entity_type}</option>
          ))}
        </select>
        <input
          name="actor"
          type="text"
          placeholder="Filter by actor email"
          className="input w-64"
          defaultValue={actorFilter}
        />
        <button type="submit" className="btn-secondary">Filter</button>
      </form>

      <p className="mb-3 text-xs text-fg3">
        Showing {rows.length} most-recent entries (capped at 500). Export coming in a later phase.
      </p>

      <AuditTable entries={rows} />
    </>
  );
}
