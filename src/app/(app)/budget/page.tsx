import Link from "next/link";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { supabaseServer } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EnterpriseBudgetPage() {
  const sb = supabaseServer();
  const { data } = await sb
    .from("v_project_budget_summary")
    .select("project_id, planned_total, committed_total, actual_total, variance_pct, projects!inner(id, code, name, status, department)")
    .order("planned_total", { ascending: false });

  const rows = (data ?? []) as any[];
  const totals = rows.reduce(
    (acc, r) => {
      acc.planned += Number(r.planned_total ?? 0);
      acc.committed += Number(r.committed_total ?? 0);
      acc.actual += Number(r.actual_total ?? 0);
      return acc;
    },
    { planned: 0, committed: 0, actual: 0 },
  );

  return (
    <>
      <PageHeader title="Portfolio budget" description="Planned / committed / actual across every active project." />
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card label="Total planned"   value={formatCurrency(totals.planned)} />
        <Card label="Total committed" value={formatCurrency(totals.committed)} />
        <Card label="Total actuals"   value={formatCurrency(totals.actual)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title="No budget data yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Project</th><th>Department</th><th className="text-right">Planned</th><th className="text-right">Committed</th><th className="text-right">Actuals</th><th>Variance</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.project_id}>
                  <td>
                    <Link href={`/projects/${r.projects.id}/budget`} className="text-brand-700 hover:underline">
                      {r.projects.code} · {r.projects.name}
                    </Link>
                  </td>
                  <td className="text-slate-600">{r.projects.department ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatCurrency(Number(r.planned_total ?? 0))}</td>
                  <td className="text-right tabular-nums">{formatCurrency(Number(r.committed_total ?? 0))}</td>
                  <td className="text-right tabular-nums">{formatCurrency(Number(r.actual_total ?? 0))}</td>
                  <td>
                    <span className={`badge ${Number(r.variance_pct) > 10 ? "bg-red-50 text-red-700 border-red-200" : Number(r.variance_pct) > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"}`}>
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
