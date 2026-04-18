import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function EnterpriseRisksPage() {
  const profile = await requireProfile();

  const rows = await sql`
    SELECT
      r.id, r.title, r.severity, r.likelihood, r.score, r.status,
      p.id AS project_id, p.code AS project_code
    FROM risks r
    JOIN projects p ON p.id = r.project_id
    WHERE r.organisation_id = ${profile.organisation_id}
      AND r.status IN ('open', 'mitigating')
    ORDER BY r.score DESC
    LIMIT 50
  `;

  return (
    <>
      <PageHeader title="Enterprise risk heatmap" description="Top risks across every active JCorp project." />
      {rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No open risks" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Risk</th><th>Project</th><th>Severity</th><th>Likelihood</th><th>Score</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.title}</td>
                  <td>
                    <Link href={`/projects/${r.project_id}`} className="card-link">
                      {r.project_code}
                    </Link>
                  </td>
                  <td className="capitalize">{r.severity}</td>
                  <td className="capitalize">{r.likelihood.replace("_"," ")}</td>
                  <td>
                    <span className={`pill ${r.score >= 12 ? "rag-red" : r.score >= 6 ? "rag-amber" : "rag-grey"}`}>
                      {r.score}
                    </span>
                  </td>
                  <td className="capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
