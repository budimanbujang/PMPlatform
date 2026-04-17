import Link from "next/link";
import { AlertCircle, FolderKanban, FileText, Target } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RagBadge } from "@/components/ui/rag-badge";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { formatDate, isoWeekStart, toISODate } from "@/lib/utils";
import type { Project, Submission, Deliverable, AiInsight } from "@/types/database";

export default async function Dashboard() {
  const profile = await requireProfile();
  const sb = supabaseServer();
  const weekStart = toISODate(isoWeekStart());

  const [{ data: projects }, { data: dueSubs }, { data: overdue }, { data: insights }] =
    await Promise.all([
      sb.from("projects")
        .select("id, code, name, status, rag, cadence, department")
        .eq("status", "active")
        .order("name"),
      sb.from("submissions")
        .select("id, project_id, initiative_id, status, due_at, period_start")
        .eq("period_start", weekStart)
        .in("status", ["draft", "missed", "late"])
        .order("due_at"),
      sb.from("deliverables")
        .select("id, project_id, title, due_date, status, owner_id")
        .eq("owner_id", profile.id)
        .in("status", ["not_started", "in_progress", "blocked"])
        .order("due_date", { ascending: true })
        .limit(10),
      sb.from("ai_insights")
        .select("*")
        .is("acknowledged_at", null)
        .order("generated_at", { ascending: false })
        .limit(5),
    ]);

  const active = (projects ?? []) as Project[];
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
        <StatCard icon={FileText}     label="Open submissions" value={dueSubs?.length ?? 0} href="/submissions" />
        <StatCard icon={Target}       label="My open deliverables" value={overdue?.length ?? 0} href="/deliverables" />
        <StatCard icon={AlertCircle}  label="Unread insights" value={insights?.length ?? 0} href="/insights" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="font-semibold">Portfolio RAG</h2>
            <Link href="/projects" className="text-sm text-brand-700 hover:underline">View all</Link>
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
                        <Link href={`/projects/${p.id}`} className="font-medium text-brand-700 hover:underline">
                          {p.code} · {p.name}
                        </Link>
                      </td>
                      <td className="text-slate-600">{p.department ?? "—"}</td>
                      <td className="capitalize text-slate-600">{p.cadence}</td>
                      <td className="capitalize text-slate-600">{p.status.replace("_", " ")}</td>
                      <td><RagBadge rag={p.rag} /></td>
                    </tr>
                  ))}
                  {active.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-slate-500 py-6">
                      No active projects yet. <Link href="/projects/new" className="text-brand-700 hover:underline">Create one →</Link>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="font-semibold">Latest insights</h2>
            <Link href="/insights" className="text-sm text-brand-700 hover:underline">View all</Link>
          </div>
          <div className="card-body space-y-3">
            {(insights ?? []).length === 0 && (
              <p className="text-sm text-slate-500">
                No insights yet. They'll appear after the first report run.
              </p>
            )}
            {(insights as AiInsight[] | null)?.map((i) => (
              <div key={i.id} className="border-l-2 border-brand-500 pl-3">
                <div className="text-xs uppercase tracking-wider text-slate-500">{i.kind.replace("_", " ")}</div>
                <div className="text-sm font-medium">{i.headline}</div>
                <div className="text-xs text-slate-500">{formatDate(i.generated_at)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Outstanding submissions — this week</h2>
          </div>
          <div className="card-body">
            {(dueSubs ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Nothing outstanding. Everyone's caught up.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(dueSubs as Submission[]).map((s) => (
                  <li key={s.id} className="py-2">
                    <Link href={`/submissions/${s.id}`} className="text-sm text-brand-700 hover:underline">
                      Submission due {formatDate(s.due_at)}
                    </Link>
                    <span className="ml-2 text-xs uppercase tracking-wider text-slate-500">{s.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">My deliverables</h2>
          </div>
          <div className="card-body">
            {(overdue ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No open deliverables assigned to you.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(overdue as Deliverable[]).map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">{d.title}</div>
                      <div className="text-xs text-slate-500">Due {formatDate(d.due_date)} · {d.status.replace("_", " ")}</div>
                    </div>
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
    <Link href={href} className="card hover:shadow-md transition">
      <div className="card-body flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </div>
    </Link>
  );
}

function RagStat({ label, count, rag }: { label: string; count: number; rag: "green"|"amber"|"red"|"grey" }) {
  const bg = { green: "bg-green-50", amber: "bg-amber-50", red: "bg-red-50", grey: "bg-slate-50" }[rag];
  const text = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", grey: "text-slate-600" }[rag];
  return (
    <div className={`rounded-md border border-slate-200 ${bg} p-3 text-center`}>
      <div className={`text-2xl font-bold tabular-nums ${text}`}>{count}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
