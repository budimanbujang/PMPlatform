import Link from "next/link";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface BudgetRow {
  project_id: string;
  planned_total: number;
  committed_total: number;
  actual_total: number;
  variance_pct: number;
  code: string;
  name: string;
  status: string;
  department: string | null;
}

export default async function EnterpriseBudgetPage() {
  const profile = await requireProfile();

  const raw = await sql`
    SELECT
      v.project_id,
      v.planned_total, v.committed_total, v.actual_total, v.variance_pct,
      p.code, p.name, p.status, p.department
    FROM v_project_budget_summary v
    JOIN projects p ON p.id = v.project_id
    WHERE p.organisation_id = ${profile.organisation_id}
  `;

  const rows: BudgetRow[] = (raw as any[])
    .map((r) => ({
      project_id:      r.project_id,
      planned_total:   Number(r.planned_total ?? 0),
      committed_total: Number(r.committed_total ?? 0),
      actual_total:    Number(r.actual_total ?? 0),
      variance_pct:    Number(r.variance_pct ?? 0),
      code:            r.code,
      name:            r.name,
      status:          r.status,
      department:      r.department,
    }))
    .filter((r) => r.planned_total > 0 || r.committed_total > 0 || r.actual_total > 0)
    .sort((a, b) => b.planned_total - a.planned_total);

  const totals = rows.reduce(
    (acc, r) => ({
      planned:   acc.planned   + r.planned_total,
      committed: acc.committed + r.committed_total,
      actual:    acc.actual    + r.actual_total,
    }),
    { planned: 0, committed: 0, actual: 0 },
  );

  return (
    <>
      <PageHeader
        title="Portfolio budget"
        description="Planned / committed / actual across every project with budget lines."
      />
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card label="Total planned"   value={formatCurrency(totals.planned)} />
        <Card label="Total committed" value={formatCurrency(totals.committed)} />
        <Card label="Total actuals"   value={formatCurrency(totals.actual)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No budget data yet"
          description="Add budget lines to a project to see them rolled up here."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Department</th>
                <th className="text-right">Planned</th>
                <th className="text-right">Committed</th>
                <th className="text-right">Actuals</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.project_id}>
                  <td>
                    <Link
                      href={`/projects/${r.project_id}/budget`}
                      className="card-link font-medium"
                    >
                      {r.code} · {r.name}
                    </Link>
                  </td>
                  <td>{r.department ?? "—"}</td>
                  <td className="text-right tabular">{formatCurrency(r.planned_total)}</td>
                  <td className="text-right tabular">{formatCurrency(r.committed_total)}</td>
                  <td className="text-right tabular">{formatCurrency(r.actual_total)}</td>
                  <td>
                    <span className={`pill ${
                      r.variance_pct > 10 ? "rag-red"
                      : r.variance_pct > 0 ? "rag-amber"
                      : "rag-green"
                    }`}>
                      {r.variance_pct}%
                    </span>
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

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-xs text-fg3">{label}</div>
        <div className="text-xl font-bold tabular">{value}</div>
      </div>
    </div>
  );
}
