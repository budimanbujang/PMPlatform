import Link from "next/link";
import { Wallet, Plus } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import type { BudgetLine } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function BudgetPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const [{ data: lines }, summaryRes] = await Promise.all([
    sb.from("budget_lines")
      .select("*, initiative:initiatives!budget_lines_initiative_id_fkey(code, name)")
      .eq("project_id", params.id)
      .order("year").order("quarter"),
    sb.from("v_project_budget_summary")
      .select("*").eq("project_id", params.id).maybeSingle(),
  ]);

  const rows = (lines ?? []) as (BudgetLine & { initiative?: { code: string; name: string } })[];
  const summary = summaryRes.data as any;
  const currency = rows[0]?.currency ?? "MYR";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryCard label="Planned"   value={formatCurrency(Number(summary?.planned_total ?? 0), currency)} />
        <SummaryCard label="Committed" value={formatCurrency(Number(summary?.committed_total ?? 0), currency)} />
        <SummaryCard label="Actuals"   value={formatCurrency(Number(summary?.actual_total ?? 0), currency)} />
        <SummaryCard label="Variance"  value={`${summary?.variance_pct ?? 0}%`}
                     tone={Number(summary?.variance_pct ?? 0) > 10 ? "red" : Number(summary?.variance_pct ?? 0) > 0 ? "amber" : "green"} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{rows.length} budget line(s)</p>
        <Link href={`/projects/${params.id}/budget/new`} className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" /> Add line
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No budget lines"
          description="Planned, committed and actual spend roll up to the portfolio dashboard."
          action={<Link href={`/projects/${params.id}/budget/new`} className="btn-primary">Add first line</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Description</th><th>Initiative</th><th>Year/Q</th><th>Category</th><th className="text-right">Planned</th><th className="text-right">Committed</th></tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">{l.description}</td>
                  <td className="text-slate-600">{l.initiative?.code ?? "—"}</td>
                  <td>{l.year}{l.quarter ? ` · Q${l.quarter}` : ""}</td>
                  <td className="capitalize">{l.category}</td>
                  <td className="text-right tabular-nums">{formatCurrency(l.planned_amount, l.currency)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(l.committed_amount, l.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "red" | "amber" | "green" }) {
  const toneClass =
    tone === "red"   ? "text-red-700"   :
    tone === "amber" ? "text-amber-700" :
    tone === "green" ? "text-green-700" : "";
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      </div>
    </div>
  );
}
