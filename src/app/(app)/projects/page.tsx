import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
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
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const profile = await requireProfile();
  const orgId = profile.organisation_id;
  const filterStatus = searchParams.status ?? "";

  // Single aggregate query — joins budget summary view + deliverables,
  // filters to the org, optionally narrows by status.
  //
  // "Budget used" on the card = GREATEST(committed, actuals). Committed
  // captures contracts / promises-to-spend (which often land well before the
  // first actuals row is recorded), while actuals captures cash paid out.
  // Whichever is higher is the honest "utilisation" number for an exec view.
  const rows = (await sql`
    SELECT
      p.id, p.code, p.name, p.description, p.status, p.priority,
      p.start_date, p.target_end_date,
      GREATEST(COALESCE(b.committed_total, 0), COALESCE(b.actual_total, 0)) AS budget_used,
      COALESCE(b.planned_total, 0) AS budget_total,
      (SELECT currency FROM budget_lines bl WHERE bl.project_id = p.id LIMIT 1) AS currency,
      (SELECT COUNT(*)::int FROM deliverables d WHERE d.project_id = p.id)                             AS tasks_total,
      (SELECT COUNT(*)::int FROM deliverables d WHERE d.project_id = p.id AND d.status = 'complete')   AS tasks_completed
    FROM projects p
    LEFT JOIN v_project_budget_summary b ON b.project_id = p.id
    WHERE p.organisation_id = ${orgId}
      AND (${filterStatus || null}::text IS NULL OR p.status::text = ${filterStatus || null})
    ORDER BY p.updated_at DESC
  `) as unknown as Row[];

  // Counts per status for the filter chip labels
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

  const cards: ProjectCardProps[] = rows.map((r) => {
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
      canDelete: profile.is_platform_admin,
    };
  });

  return (
    <>
      <PageHeader
        title="Project register"
        description="Every project registered across JCorp HoldCo. Filter by status."
        actions={
          <Link href="/projects/new" className="btn-primary">
            <Plus className="mr-1.5 h-4 w-4" /> New project
          </Link>
        }
      />

      <div className="mb-5">
        <ProjectStatusFilter activeStatus={filterStatus} counts={counts} />
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={
            filterStatus
              ? "Nothing in this status. Try another filter."
              : "Create the first project to get started."
          }
          action={<Link href="/projects/new" className="btn-primary">Create project</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => <ProjectCard key={c.id} {...c} />)}
        </div>
      )}
    </>
  );
}
