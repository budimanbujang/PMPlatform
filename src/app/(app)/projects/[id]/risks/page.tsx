import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { sql } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { Risk } from "@/types/database";
import { RiskActions } from "./risk-actions";

export const dynamic = "force-dynamic";

export default async function RisksPage({ params }: { params: { id: string } }) {
  const risks = (await sql`
    SELECT * FROM risks
    WHERE project_id = ${params.id}
    ORDER BY score DESC
  `) as unknown as Risk[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg3">{risks.length} registered · top of list has highest severity × likelihood score.</p>
        <Link href={`/projects/${params.id}/risks/new`} className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" /> Add risk
        </Link>
      </div>

      {risks.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No risks logged"
          description="A living risk register is the first thing sponsors look at."
          action={<Link href={`/projects/${params.id}/risks/new`} className="btn-primary">Add first risk</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Severity</th><th>Likelihood</th><th>Score</th><th>Status</th><th>Next review</th><th></th></tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium">{r.title}</div>
                    {r.mitigation && <div className="text-xs text-fg3">Mitigation: {r.mitigation}</div>}
                  </td>
                  <td className="capitalize">{r.severity}</td>
                  <td className="capitalize">{r.likelihood.replace("_", " ")}</td>
                  <td>
                    <span className={`pill ${r.score >= 12 ? "rag-red" : r.score >= 6 ? "rag-amber" : "rag-grey"}`}>
                      {r.score}
                    </span>
                  </td>
                  <td className="capitalize">{r.status}</td>
                  <td>{formatDate(r.next_review_at)}</td>
                  <td className="text-right"><RiskActions riskId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
