import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers, ArrowLeft } from "lucide-react";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { ProjectCard, type ProjectCardProps } from "../../projects/project-card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PortfolioRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectCardProps["status"];
  priority: ProjectCardProps["priority"];
  start_date: string | null;
  target_end_date: string | null;
  budget_used: string | null;
  budget_total: string | null;
  currency: string | null;
  tasks_total: string | null;
  tasks_completed: string | null;
}

export default async function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();

  const portfolioRows = (await sql`
    SELECT id, code, name, description
    FROM portfolios
    WHERE id = ${params.id}
      AND organisation_id = ${profile.organisation_id}
    LIMIT 1
  `) as unknown as PortfolioRow[];
  const portfolio = portfolioRows[0];
  if (!portfolio) notFound();

  const projectRows = (await sql`
    SELECT
      p.id, p.code, p.name, p.description, p.status, p.priority,
      p.start_date, p.target_end_date,
      GREATEST(COALESCE(b.committed_total, 0), COALESCE(b.actual_total, 0)) AS budget_used,
      COALESCE(b.planned_total, 0) AS budget_total,
      (SELECT currency FROM budget_lines bl WHERE bl.project_id = p.id LIMIT 1) AS currency,
      (SELECT COUNT(*)::int FROM deliverables d WHERE d.project_id = p.id)                            AS tasks_total,
      (SELECT COUNT(*)::int FROM deliverables d WHERE d.project_id = p.id AND d.status = 'complete')  AS tasks_completed
    FROM projects p
    LEFT JOIN v_project_budget_summary b ON b.project_id = p.id
    WHERE p.portfolio_id = ${portfolio.id}
      AND p.status <> 'archived'
    ORDER BY p.name
  `) as unknown as ProjectRow[];

  // Roll-ups for the portfolio header
  const totalBudget = projectRows.reduce((s, r) => s + Number(r.budget_total ?? 0), 0);
  const totalUsed   = projectRows.reduce((s, r) => s + Number(r.budget_used  ?? 0), 0);
  const totalActive = projectRows.filter((r) => r.status === "active").length;
  const totalAtRisk = projectRows.filter((r) => r.status === "on_hold").length;
  const totalDone   = projectRows.filter((r) => r.status === "closed").length;

  const cards: ProjectCardProps[] = projectRows.map((r) => {
    const tasksTotal = Number(r.tasks_total ?? 0);
    const tasksCompleted = Number(r.tasks_completed ?? 0);
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      status: r.status,
      priority: r.priority,
      progressPercentage: tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0,
      budgetUsed:  Number(r.budget_used ?? 0),
      budgetTotal: Number(r.budget_total ?? 0),
      currency: r.currency ?? "MYR",
      tasksCompleted,
      tasksTotal,
      startDate: r.start_date,
      endDate: r.target_end_date,
      canDelete: profile.is_platform_admin,
    };
  });

  return (
    <>
      <div className="mb-3">
        <Link
          href="/portfolios"
          className="inline-flex items-center gap-1 text-[12px] text-fg3 hover:text-fg1"
        >
          <ArrowLeft className="h-3 w-3" />
          All portfolios
        </Link>
      </div>

      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-300">
          <Layers className="h-5 w-5 stroke-[1.8]" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg3">
            Portfolio · {portfolio.code}
          </div>
          <h1 className="display-h2 mt-0.5">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="mt-1 text-[14px] text-fg3 max-w-3xl">{portfolio.description}</p>
          )}
        </div>
      </div>

      {/* Roll-up stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Projects"  value={projectRows.length} />
        <Stat label="Active"    value={totalActive} tone="blue" />
        <Stat label="On hold"   value={totalAtRisk} tone="amber" />
        <Stat label="Completed" value={totalDone}   tone="green" />
        <Stat label="Budget"    value={`${totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0}%`} sub={formatCurrency(totalUsed) + " / " + formatCurrency(totalBudget)} />
      </div>

      <h2 className="eyebrow mb-3">Projects in this portfolio</h2>

      {cards.length === 0 ? (
        <p className="text-sm text-fg3 py-6 text-center">
          No projects in this portfolio yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => <ProjectCard key={c.id} {...c} />)}
        </div>
      )}
    </>
  );
}

function Stat({
  label, value, sub, tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "blue" | "amber" | "green";
}) {
  const toneClass =
    tone === "blue"  ? "text-blue-700 dark:text-blue-300"   :
    tone === "amber" ? "text-amber-700 dark:text-amber-300" :
    tone === "green" ? "text-green-700 dark:text-green-300" : "text-fg1";
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-[10px] uppercase tracking-wider text-fg3">{label}</div>
        <div className={`mt-0.5 text-[20px] font-bold tabular ${toneClass}`}>{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-fg3 truncate">{sub}</div>}
      </div>
    </div>
  );
}
