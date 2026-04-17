import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { RagBadge } from "@/components/ui/rag-badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Initiative, Risk, Deliverable, Submission } from "@/types/database";

export default async function ProjectOverview({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const [{ data: initiatives }, { data: recent }, { data: risks }, { data: deliverables }, budgetRes] =
    await Promise.all([
      sb.from("initiatives")
        .select("*").eq("project_id", params.id).order("sort_order"),
      sb.from("submissions")
        .select("id, period_start, period_end, rag, status, headline, submitted_at, initiative_id")
        .eq("project_id", params.id)
        .order("period_start", { ascending: false })
        .limit(10),
      sb.from("risks")
        .select("id, title, severity, likelihood, score, status")
        .eq("project_id", params.id)
        .in("status", ["open", "mitigating"])
        .order("score", { ascending: false })
        .limit(5),
      sb.from("deliverables")
        .select("id, title, due_date, status, owner_id")
        .eq("project_id", params.id)
        .in("status", ["not_started", "in_progress", "blocked"])
        .order("due_date")
        .limit(5),
      sb.from("v_project_budget_summary")
        .select("*").eq("project_id", params.id).maybeSingle(),
    ]);

  const budget = budgetRes.data as {
    planned_total: number | null;
    committed_total: number | null;
    actual_total: number | null;
    variance_pct: number | null;
  } | null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="card lg:col-span-2">
        <div className="card-header"><h2 className="font-semibold">Initiatives</h2></div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Code</th><th>Name</th><th>RAG</th><th>Champion</th></tr>
              </thead>
              <tbody>
                {(initiatives as Initiative[] | null)?.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.code}</td>
                    <td className="font-medium">{i.name}</td>
                    <td><RagBadge rag={i.rag} /></td>
                    <td className="text-slate-600">{i.champion_id ?? "—"}</td>
                  </tr>
                ))}
                {!initiatives?.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">
                    No initiatives yet. <Link href={`/projects/${params.id}/initiatives`} className="text-brand-700 hover:underline">Add one →</Link>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="font-semibold">Budget</h2></div>
        <div className="card-body space-y-3 text-sm">
          <Row label="Planned"   value={formatCurrency(budget?.planned_total ?? 0)} />
          <Row label="Committed" value={formatCurrency(budget?.committed_total ?? 0)} />
          <Row label="Actuals"   value={formatCurrency(budget?.actual_total ?? 0)} />
          <Row label="Variance"  value={`${budget?.variance_pct ?? 0}%`} />
          <Link href={`/projects/${params.id}/budget`} className="mt-2 inline-block text-sm text-brand-700 hover:underline">
            Manage budget →
          </Link>
        </div>
      </section>

      <section className="card lg:col-span-2">
        <div className="card-header">
          <h2 className="font-semibold">Recent submissions</h2>
          <Link href={`/projects/${params.id}/reports`} className="text-sm text-brand-700 hover:underline">All reports →</Link>
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Period</th><th>RAG</th><th>Status</th><th>Headline</th></tr></thead>
              <tbody>
                {(recent as Submission[] | null)?.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDate(s.period_start)} – {formatDate(s.period_end)}</td>
                    <td><RagBadge rag={s.rag} /></td>
                    <td className="capitalize">{s.status}</td>
                    <td className="text-slate-700">{s.headline ?? "—"}</td>
                  </tr>
                ))}
                {!recent?.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">No submissions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="font-semibold">Top risks</h2></div>
        <div className="card-body space-y-2">
          {(risks as Risk[] | null)?.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{r.title}</span>
              <span className="badge bg-red-50 text-red-700 border-red-200">Score {r.score}</span>
            </div>
          ))}
          {!risks?.length && <p className="text-sm text-slate-500">No open risks.</p>}
        </div>
      </section>

      <section className="card lg:col-span-3">
        <div className="card-header"><h2 className="font-semibold">Upcoming deliverables</h2></div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Title</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>
                {(deliverables as Deliverable[] | null)?.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.title}</td>
                    <td className="capitalize">{d.status.replace("_", " ")}</td>
                    <td>{formatDate(d.due_date)}</td>
                  </tr>
                ))}
                {!deliverables?.length && (
                  <tr><td colSpan={3} className="py-6 text-center text-slate-500">Nothing upcoming.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
