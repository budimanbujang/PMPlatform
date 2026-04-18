import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RagBadge } from "@/components/ui/rag-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MySubmissionsPage() {
  const profile = await requireProfile();

  const rows = await sql`
    SELECT
      s.id, s.period_start, s.period_end, s.rag, s.status, s.submitted_by,
      s.initiative_id, s.project_id,
      p.id   AS project_id_d, p.code AS project_code, p.name AS project_name,
      i.id   AS init_id,     i.code AS init_code,    i.name AS init_name
    FROM submissions s
    LEFT JOIN projects    p ON p.id = s.project_id
    LEFT JOIN initiatives i ON i.id = s.initiative_id
    WHERE s.organisation_id = ${profile.organisation_id}
      AND (
        s.submitted_by = ${profile.id}
        OR s.initiative_id IN (
          SELECT initiative_id FROM members
          WHERE profile_id = ${profile.id}
            AND role IN ('champion', 'io')
            AND initiative_id IS NOT NULL
        )
      )
    ORDER BY s.period_start DESC
    LIMIT 100
  `;

  return (
    <>
      <PageHeader title="My submissions" description="Past and current updates you're responsible for." />
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No submissions yet" description="Your Champion/IO work will appear here." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Period</th><th>Project</th><th>Initiative</th><th>RAG</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((s: any) => (
                <tr key={s.id}>
                  <td>{formatDate(s.period_start)} – {formatDate(s.period_end)}</td>
                  <td><Link href={`/projects/${s.project_id}`} className="font-medium">{s.project_code}</Link></td>
                  <td>{s.init_code ?? "—"}</td>
                  <td><RagBadge rag={s.rag} /></td>
                  <td className="capitalize">{s.status}</td>
                  <td className="text-right">
                    <Link href={`/projects/${s.project_id}/submit?initiative=${s.init_id}&period=${s.period_start}`} className="card-link">
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
