import Link from "next/link";
import { AlertCircle, FolderKanban, FileText, Target } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RagBadge } from "@/components/ui/rag-badge";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { formatDate, isoWeekStart, toISODate } from "@/lib/utils";
import type { Project, Submission, Deliverable, AiInsight } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const profile = await requireProfile();
  const weekStart = toISODate(isoWeekStart());
  const orgId = profile.organisation_id;

  const [projectsRows, dueRows, overdueRows, insightRows] = await Promise.all([
    sql`
      SELECT id, code, name, status, rag, cadence, department
      FROM projects
      WHERE organisation_id = ${orgId} AND status = 'active'
      ORDER BY name
    `,
    sql`
      SELECT id, project_id, initiative_id, status, due_at, period_start
      FROM submissions
      WHERE organisation_id = ${orgId}
        AND period_start = ${weekStart}
        AND status IN ('draft', 'missed', 'late')
      ORDER BY due_at
    `,
    sql`
      SELECT id, project_id, title, due_date, status, owner_id
      FROM deliverables
      WHERE owner_id = ${profile.id}
        AND status IN ('not_started', 'in_progress', 'blocked')
      ORDER BY due_date NULLS LAST
      LIMIT 10
    `,
    sql`
      SELECT *
      FROM ai_insights
      WHERE organisation_id = ${orgId}
        AND acknowledged_at IS NULL
      ORDER BY generated_at DESC
      LIMIT 5
    `,
  ]);

  const active   = projectsRows as unknown as Project[];
  const dueSubs  = dueRows      as unknown as Submission[];
  const overdue  = overdueRows  as unknown as Deliverable[];
  const insights = insightRows  as unknown as AiInsight[];

  const ragCounts = {
    green: active.filter((p) => p.rag === "green").length,
    amber: active.filter((p) => p.rag === "amber").length,
    red:   active.filter((p) => p.rag === "red").length,
    grey:  active.filter((p) => p.rag === "grey").length,
  };

  return (
    <>
      <PageHeader
        title={`Good ${greet()}, ${profile.full_name?.split(" ")[0] ?? "there"}`}
        description="Live snapshot of portfolio health, outstanding work, and AI insights."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon={FolderKanban} label="Active projects" value={active.length} href="/projects" />
        <StatCard icon={FileText}     label="Open submissions" value={dueSubs.length} href="/submissions" />
        <StatCard icon={Target}       label="My open deliverables" value={overdue.length} href="/deliverables" />
        <StatCard icon={AlertCircle}  label="Unread insights" value={insights.length} href="/insights" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Portfolio RAG</h2>
            <Link href="/projects" className="card-link">View all</Link>
          </div>
          <div className="card-body">
            <div className="mb-4 grid grid-cols-4 gap-3">
              <RagStat label="On track" count={ragCounts.green} rag="green" />
              <RagStat label="At risk"  count={ragCounts.amber} rag="amber" />
              <RagStat label="Blocked"  count={ragCounts.red}   rag="red" />
              <RagStat label="Pending"  count={ragCounts.grey}  rag="grey" />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Project</th><th>Department</th><th>Cadence</th><th>Status</th><th>RAG</th></tr>
                </thead>
                <tbody>
                  {active.slice(0, 10).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/projects/${p.id}`} className="font-medium">
                          {p.code} · {p.name}
                        </Link>
                      </td>
                      <td>{p.department ?? "—"}</td>
                      <td className="capitalize">{p.cadence}</td>
                      <td className="capitalize">{p.status.replace("_", " ")}</td>
                      <td><RagBadge rag={p.rag} /></td>
                    </tr>
                  ))}
                  {active.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-fg3 py-6">
                      No active projects yet. <Link href="/projects/new" className="card-link">Create one →</Link>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Latest insights</h2>
            <Link href="/insights" className="card-link">View all</Link>
          </div>
          <div className="card-body space-y-3">
            {insights.length === 0 && (
              <p className="text-sm text-fg3">
                No insights yet. They'll appear after the first report run.
              </p>
            )}
            {insights.map((i) => (
              <div key={i.id} className="border-l-2 border-brand-500 pl-3">
                <div className="eyebrow">{i.kind.replace("_", " ")}</div>
                <div className="text-sm font-medium">{i.headline}</div>
                <div className="text-xs text-fg3">{formatDate(i.generated_at)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header"><h2 className="card-title">Outstanding submissions — this week</h2></div>
          <div className="card-body">
            {dueSubs.length === 0 ? (
              <p className="text-sm text-fg3">Nothing outstanding. Everyone's caught up.</p>
            ) : (
              <ul className="divide-y divide-border">
                {dueSubs.map((s) => (
                  <li key={s.id} className="py-2">
                    <Link href={`/submissions`} className="text-sm">
                      Submission due {formatDate(s.due_at)}
                    </Link>
                    <span className="ml-2 text-xs uppercase tracking-wider text-fg3">{s.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="card-title">My deliverables</h2></div>
          <div className="card-body">
            {overdue.length === 0 ? (
              <p className="text-sm text-fg3">No open deliverables assigned to you.</p>
            ) : (
              <ul className="divide-y divide-border">
                {overdue.map((d) => (
                  <li key={d.id} className="py-2">
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-fg3">Due {formatDate(d.due_date)} · {d.status.replace("_", " ")}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function StatCard({
  icon: Icon, label, value, href,
}: { icon: any; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="stat">
      <div className="stat-well"><Icon className="h-5 w-5 stroke-[1.8]" /></div>
      <div>
        <div className="stat-n">{value}</div>
        <div className="stat-l">{label}</div>
      </div>
    </Link>
  );
}

function RagStat({ label, count, rag }: { label: string; count: number; rag: "green"|"amber"|"red"|"grey" }) {
  const toneBg = {
    green: "bg-green-50 dark:bg-green-900/10",
    amber: "bg-amber-50 dark:bg-amber-900/10",
    red:   "bg-red-50 dark:bg-red-900/10",
    grey:  "bg-bg-muted",
  }[rag];
  const toneText = {
    green: "text-green-700 dark:text-green-300",
    amber: "text-amber-700 dark:text-amber-300",
    red:   "text-red-700 dark:text-red-300",
    grey:  "text-fg2",
  }[rag];
  return (
    <div className={`rounded-md border border-border ${toneBg} p-3 text-center`}>
      <div className={`text-2xl font-bold tabular ${toneText}`}>{count}</div>
      <div className="text-xs text-fg3">{label}</div>
    </div>
  );
}
