import Link from "next/link";
import { FolderKanban, Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { ProjectCard, type ProjectCardProps } from "./project-card";
import { ProjectStatusFilter } from "./status-filter";

export const dynamic = "force-dynamic";

type Row = {
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
  portfolio_id: string | null;
  portfolio_name: string | null;
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const profile = await requireProfile();
  const orgId = profile.organisation_id;
  const filterStatus = searchParams.status ?? "";

  const rows = (await sql`
    SELECT
      p.id, p.code, p.name, p.description, p.status, p.priority,
      p.start_date, p.target_end_date,
      GREATEST(COALESCE(b.committed_total, 0), COALESCE(b.actual_total, 0)) AS budget_used,
      COALESCE(b.planned_total, 0) AS budget_total,
      (SELECT currency FROM budget_lines bl WHERE bl.project_id = p.id LIMIT 1) AS currency,
      (SELECT COUNT(*)::int FROM deliverables d WHERE d.project_id = p.id)                             AS tasks_total,
      (SELECT COUNT(*)::int FROM deliverables d WHERE d.project_id = p.id AND d.status = 'complete')   AS tasks_completed,
      pf.id   AS portfolio_id,
      pf.name AS portfolio_name
    FROM projects p
    LEFT JOIN v_project_budget_summary b ON b.project_id = p.id
    LEFT JOIN portfolios pf ON pf.id = p.portfolio_id
    WHERE p.organisation_id = ${orgId}
      AND (${filterStatus || null}::text IS NULL OR p.status::text = ${filterStatus || null})
    ORDER BY pf.name NULLS LAST, p.updated_at DESC
  `) as unknown as Row[];

  const countRows = (await sql`
    SELECT status::text AS status, COUNT(*)::int AS count
    FROM projects
    WHERE organisation_id = ${orgId}
    GROUP BY status
  `) as unknown as { status: string; count: number }[];

  const counts: Record<string, number> = { total: 0 };
  for (const r of countRows) {
    counts[r.status] = Number(r.count);
    counts.total += Number(r.count);
  }

  const cards: (ProjectCardProps & { _portfolioId: string | null; _portfolioName: string })[] = rows.map((r) => {
    const tasksTotal = Number(r.tasks_total ?? 0);
    const tasksCompleted = Number(r.tasks_completed ?? 0);
    const progressPercentage =
      tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      status: r.status,
      priority: r.priority,
      progressPercentage,
      budgetUsed:  Number(r.budget_used ?? 0),
      budgetTotal: Number(r.budget_total ?? 0),
      currency: r.currency ?? "MYR",
      tasksCompleted,
      tasksTotal,
      startDate: r.start_date,
      endDate: r.target_end_date,
      portfolioId: r.portfolio_id,
      portfolioName: r.portfolio_name,
      canDelete: profile.is_platform_admin,
      _portfolioId: r.portfolio_id,
      _portfolioName: r.portfolio_name ?? "Independent",
    };
  });

  // Group cards by portfolio. Cards with no portfolio_id land under "Independent".
  // Map preserves insertion order, so portfolios appear alphabetically (the
  // SQL ORDER BY did the heavy lifting), with "Independent" pinned to the end.
  const groups = new Map<string, { id: string | null; name: string; cards: typeof cards }>();
  for (const c of cards) {
    const key = c._portfolioId ?? "__independent__";
    if (!groups.has(key)) {
      groups.set(key, { id: c._portfolioId, name: c._portfolioName, cards: [] });
    }
    groups.get(key)!.cards.push(c);
  }
  const groupedList = Array.from(groups.values()).sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <PageHeader
        title="Project register"
        description="Every project registered across JCorp HoldCo, grouped by the portfolio they belong to."
      />

      <div className="mb-5">
        <ProjectStatusFilter activeStatus={filterStatus} counts={counts} />
      </div>

      <p className="mb-5 rounded-md border border-border bg-bg-subtle px-4 py-2.5 text-[12px] text-fg3">
        Projects are now created from inside a portfolio. Visit{" "}
        <Link href="/portfolios" className="font-medium text-fg-brand hover:underline">Portfolios</Link>{" "}
        to add a new one.
      </p>

      {cards.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={
            filterStatus
              ? "Nothing in this status. Try another filter."
              : "Open a portfolio and add the first project there."
          }
          action={<Link href="/portfolios" className="btn-primary">Browse portfolios</Link>}
        />
      ) : (
        <div className="space-y-8">
          {groupedList.map((group) => (
            <section key={group.id ?? "independent"}>
              <header className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-fg1">
                  <Layers className="h-4 w-4 text-brand-600" />
                  {group.id ? (
                    <Link href={`/portfolios/${group.id}`} className="hover:underline">
                      {group.name}
                    </Link>
                  ) : (
                    <span className="text-fg2">{group.name}</span>
                  )}
                  <span className="ml-1 rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium tabular text-fg3">
                    {group.cards.length}
                  </span>
                </h2>
              </header>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.cards.map((c) => <ProjectCard key={c.id} {...c} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
