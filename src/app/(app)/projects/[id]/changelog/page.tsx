import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { AuditTable, type AuditEntry } from "@/components/ui/audit-table";

export const dynamic = "force-dynamic";

export default async function ProjectChangelogPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();

  // We store projectId inside the audit diff JSON when logging actions that
  // affect a project-scoped entity (budget lines, risks, deliverables, etc.).
  // Filter by that so this tab only shows entries relevant to this project.
  const rows = (await sql`
    SELECT
      a.id, a.at, a.action, a.entity_type, a.entity_id, a.diff,
      p.full_name AS actor_name, p.email AS actor_email
    FROM audit_log a
    LEFT JOIN profiles p ON p.id = a.actor_id
    WHERE a.organisation_id = ${profile.organisation_id}
      AND a.diff->>'projectId' = ${params.id}
    ORDER BY a.at DESC
    LIMIT 200
  `) as unknown as AuditEntry[];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-fg3">
          Every change made to this project&apos;s budget lines, risks, deliverables, and
          membership is captured here with the actor and timestamp.
        </p>
      </div>
      <AuditTable entries={rows} />
    </div>
  );
}
