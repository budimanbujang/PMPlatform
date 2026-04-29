import Link from "next/link";
import { sql } from "@/lib/db";
import { RagBadge } from "@/components/ui/rag-badge";
import { Gantt, type GanttRow } from "@/components/ui/gantt";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Initiative, Risk, Deliverable, Submission } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProjectOverview({ params }: { params: { id: string } }) {
  const projectId = params.id;

  const [initiativesRows, recentRows, risksRows, delivRows, budgetRows] = await Promise.all([
    sql`
      SELECT * FROM initiatives
      WHERE project_id = ${projectId}
      ORDER BY sort_order
    `,
    sql`
      SELECT id, period_start, period_end, rag, status, headline, submitted_at, initiative_id
      FROM submissions
      WHERE project_id = ${projectId}
      ORDER BY period_start DESC
      LIMIT 10
    `,
    sql`
      SELECT id, title, severity, likelihood, score, status
      FROM risks
      WHERE project_id = ${projectId}
        AND status IN ('open', 'mitigating')
      ORDER BY score DESC
      LIMIT 5
    `,
    sql`
      SELECT id, title, due_date, status, owner_id
      FROM deliverables
      WHERE project_id = ${projectId}
        AND status IN ('not_started', 'in_progress', 'blocked')
      ORDER BY due_date
      LIMIT 5
    `,
    sql`
      SELECT planned_total, committed_total, actual_total, variance_pct
      FROM v_project_budget_summary
      WHERE project_id = ${projectId}
      LIMIT 1
    `,
  ]);

  const initiatives  = initiativesRows as unknown as Initiative[];
  const recent       = recentRows      as unknown as Submission[];
  const risks        = risksRows       as unknown as Risk[];
  const deliverables = delivRows       as unknown as Deliverable[];
  const budget       = (budgetRows[0] ?? null) as {
    planned_total: number | null;
    committed_total: number | null;
    actual_total: number | null;
    variance_pct: number | null;
  } | null;

  return (
    <div className="space-y-6">
      {/* Initiatives Gantt — full width above the rest of the overview */}
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Initiative timeline</h2>
          <Link
            href={`/projects/${projectId}/initiatives`}
            className="card-link"
          >
            Manage →
          </Link>
        </div>
        <div className="card-body">
          <Gantt
            rows={initiatives.map<GanttRow>((i) => ({
              id: i.id,
              label: i.name,
              sub: i.code,
              start: (i as any).start_date,
              end: (i as any).target_end_date,
              rag: i.rag,
              href: `/projects/${projectId}/initiatives`,
            }))}
            emptyMessage="Initiatives have no start / target end dates yet. Add them on the Initiatives tab to see the Gantt."
          />
        </div>
      </section>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="card lg:col-span-2">
        <div className="card-header"><h2 className="card-title">Initiatives</h2></div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Code</th><th>Name</th><th>RAG</th><th>Champion</th></tr>
              </thead>
              <tbody>
                {initiatives.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.code}</td>
                    <td className="font-medium">{i.name}</td>
                    <td><RagBadge rag={i.rag} /></td>
                    <td>{i.champion_id ?? "—"}</td>
                  </tr>
                ))}
                {initiatives.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-fg3">
                    No initiatives yet. <Link href={`/projects/${projectId}/initiatives`} className="card-link">Add one →</Link>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Budget</h2></div>
        <div className="card-body space-y-3 text-sm">
          <Row label="Planned"   value={formatCurrency(Number(budget?.planned_total ?? 0))} />
          <Row label="Committed" value={formatCurrency(Number(budget?.committed_total ?? 0))} />
          <Row label="Actuals"   value={formatCurrency(Number(budget?.actual_total ?? 0))} />
          <Row label="Variance"  value={`${Number(budget?.variance_pct ?? 0)}%`} />
          <Link href={`/projects/${projectId}/budget`} className="mt-2 inline-block card-link">
            Manage budget →
          </Link>
        </div>
      </section>

      <section className="card lg:col-span-2">
        <div className="card-header">
          <h2 className="card-title">Recent submissions</h2>
          <Link href={`/projects/${projectId}/reports`} className="card-link">All reports →</Link>
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Period</th><th>RAG</th><th>Status</th><th>Headline</th></tr></thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDate(s.period_start)} – {formatDate(s.period_end)}</td>
                    <td><RagBadge rag={s.rag} /></td>
                    <td className="capitalize">{s.status}</td>
                    <td>{s.headline ?? "—"}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-fg3">No submissions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title">Top risks</h2></div>
        <div className="card-body space-y-2">
          {risks.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{r.title}</span>
              <span className="pill rag-red">Score {r.score}</span>
            </div>
          ))}
          {risks.length === 0 && <p className="text-sm text-fg3">No open risks.</p>}
        </div>
      </section>

      <section className="card lg:col-span-3">
        <div className="card-header"><h2 className="card-title">Upcoming deliverables</h2></div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Title</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>
                {deliverables.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.title}</td>
                    <td className="capitalize">{d.status.replace("_", " ")}</td>
                    <td>{formatDate(d.due_date)}</td>
                  </tr>
                ))}
                {deliverables.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-fg3">Nothing upcoming.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg3">{label}</span>
      <span className="font-medium tabular">{value}</span>
    </div>
  );
}
