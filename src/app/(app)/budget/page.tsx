import Link from "next/link";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { supabaseServer } from "@/lib/supabase/server";
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
  const sb = supabaseServer();

  // PostgREST can't infer relationships on a view, so the previous
  // `v_project_budget_summary.select("projects!inner(...)")` returned empty.
  // Query the view and the projects table separately, merge in JS, skip
  // projects with no budget lines.
  const [summaryRes, projectsRes] = await Promise.all([
    sb.from("v_project_budget_summary")
      .select("project_id, planned_total, committed_total, actual_total, variance_pct"),
    sb.from("projects")
      .select("id, code, name, status, department")
      .in("status", ["active", "on_hold", "draft"]),
  ]);

  const projectsById = new Map(
    (projectsRes.data ?? []).map((p) => [p.id, p]),
  );

  const rows: BudgetRow[] = (summaryRes.data ?? [])
    .map((s) => {
      const p = projectsById.get(s.project_id);
      if (!p) return null;
      return {
        project_id: s.project_id,
        planned_total: Number(s.planned_total ?? 0),
        committed_total: Number(s.committed_total ?? 0),
        actual_total: Number(s.actual_total ?? 0),
        variance_pct: Number(s.variance_pct ?? 0),
        code: p.code,
        name: p.name,
        status: p.status,
        department: p.department,
      } as BudgetRow;
    })
    .filter((r): r is BudgetRow => r !== null)
    .filter((r) => r.planned_total > 0 || r.committed_total > 0 || r.actual_total > 0)
    .sort((a, b) => b.planned_total - a.planned_total);

  const totals = rows.reduce(
    (acc, r) => {
      acc.planned += r.planned_total;
      acc.committed += r.committed_total;
      acc.actual += r.actual_total;
      return acc;
    },
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
                      className="text-brand-700 hover:underline font-medium"
                    >
                      {r.code} · {r.name}
                    </Link>
                  </td>
                  <td className="text-slate-600">{r.department ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatCurrency(r.planned_total)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(r.committed_total)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(r.actual_total)}</td>
                  <td>
                    <span className={`badge ${
                      r.variance_pct > 10 ? "bg-red-50 text-red-700 border-red-200"
                      : r.variance_pct > 0 ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-green-50 text-green-700 border-green-200"
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
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
