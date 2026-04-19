import Link from "next/link";
import { Wallet, Plus } from "lucide-react";
import { sql } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { BudgetRowActions, type BudgetRow, type Initiative } from "./row-edit";
import { ImportActualsButton, type BudgetLineLite } from "./import-actuals";

export const dynamic = "force-dynamic";

export default async function BudgetPage({ params }: { params: { id: string } }) {
  const [lines, summaryRows, initiatives] = await Promise.all([
    sql`
      SELECT bl.*, i.code AS init_code, i.name AS init_name
      FROM budget_lines bl
      LEFT JOIN initiatives i ON i.id = bl.initiative_id
      WHERE bl.project_id = ${params.id}
      ORDER BY bl.year, bl.quarter NULLS LAST
    `,
    sql`
      SELECT planned_total, committed_total, actual_total, variance_pct
      FROM v_project_budget_summary
      WHERE project_id = ${params.id}
      LIMIT 1
    `,
    sql`SELECT id, code, name FROM initiatives WHERE project_id = ${params.id} ORDER BY sort_order`,
  ]);

  const rows = lines as any[];
  const summary = (summaryRows[0] ?? null) as any;
  const currency = rows[0]?.currency ?? "MYR";
  const variance = Number(summary?.variance_pct ?? 0);

  const initiativeList = initiatives as unknown as Initiative[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryCard label="Planned"   value={formatCurrency(Number(summary?.planned_total ?? 0), currency)} />
        <SummaryCard label="Committed" value={formatCurrency(Number(summary?.committed_total ?? 0), currency)} />
        <SummaryCard label="Actuals"   value={formatCurrency(Number(summary?.actual_total ?? 0), currency)} />
        <SummaryCard
          label="Variance"
          value={`${variance}%`}
          tone={variance > 10 ? "red" : variance > 0 ? "amber" : "green"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg3">{rows.length} budget line(s)</p>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <ImportActualsButton
              projectId={params.id}
              budgetLines={rows.map((l) => ({
                id: l.id,
                description: l.description,
                initiative_code: l.init_code ?? null,
                year: l.year,
                quarter: l.quarter,
              })) as BudgetLineLite[]}
            />
          )}
          <Link href={`/projects/${params.id}/budget/new`} className="btn-primary">
            <Plus className="mr-1.5 h-4 w-4" /> Add line
          </Link>
        </div>
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
              <tr>
                <th>Description</th><th>Initiative</th><th>Year/Q</th><th>Category</th>
                <th className="text-right">Planned</th>
                <th className="text-right">Committed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const budgetRow: BudgetRow = {
                  id: l.id,
                  description: l.description,
                  initiative_id: l.initiative_id,
                  year: l.year,
                  quarter: l.quarter,
                  category: l.category,
                  currency: l.currency,
                  planned_amount: Number(l.planned_amount),
                  committed_amount: Number(l.committed_amount),
                };
                return (
                  <tr key={l.id}>
                    <td className="font-medium">{l.description}</td>
                    <td>{l.init_code ?? "—"}</td>
                    <td>{l.year}{l.quarter ? ` · Q${l.quarter}` : ""}</td>
                    <td className="capitalize">{l.category}</td>
                    <td className="text-right tabular">{formatCurrency(Number(l.planned_amount), l.currency)}</td>
                    <td className="text-right tabular">{formatCurrency(Number(l.committed_amount), l.currency)}</td>
                    <td className="text-right">
                      <BudgetRowActions
                        projectId={params.id}
                        row={budgetRow}
                        initiatives={initiativeList}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "red" | "amber" | "green" }) {
  const toneClass =
    tone === "red"   ? "text-red-700 dark:text-red-300"   :
    tone === "amber" ? "text-amber-700 dark:text-amber-300" :
    tone === "green" ? "text-green-700 dark:text-green-300" : "";
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-xs text-fg3">{label}</div>
        <div className={`text-xl font-bold tabular ${toneClass}`}>{value}</div>
      </div>
    </div>
  );
}
