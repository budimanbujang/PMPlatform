import Link from "next/link";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { getAuthContext, canViewPortfolio } from "@/lib/portfolio-access";
import { formatCurrency } from "@/lib/utils";
import { CreatePortfolioButton } from "./create-button";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  code: string;
  name: string;
  description: string | null;
  division: string | null;
  department: string | null;
  organisation_id: string;
  access_mode: string;
  allowed_entra_groups: string[];
  project_count: number;
  active_count: number;
  initiative_count: number;
  budget_planned: number;
  budget_used: number;
}

export default async function PortfoliosPage() {
  const profile = await requireProfile();
  const ctx = await getAuthContext();

  const allRows = (await sql`
    SELECT
      pf.id, pf.code, pf.name, pf.description, pf.division, pf.department,
      pf.organisation_id, pf.access_mode, pf.allowed_entra_groups,
      COALESCE(p.project_count,    0) AS project_count,
      COALESCE(p.active_count,     0) AS active_count,
      COALESCE(p.initiative_count, 0) AS initiative_count,
      COALESCE(b.budget_planned,   0) AS budget_planned,
      COALESCE(b.budget_used,      0) AS budget_used
    FROM portfolios pf
    LEFT JOIN (
      SELECT
        portfolio_id,
        COUNT(*)::int AS project_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::int AS active_count,
        (SELECT COUNT(*)::int
         FROM initiatives i
         JOIN projects p2 ON p2.id = i.project_id
         WHERE p2.portfolio_id = projects.portfolio_id) AS initiative_count
      FROM projects
      WHERE portfolio_id IS NOT NULL
      GROUP BY portfolio_id
    ) p ON p.portfolio_id = pf.id
    LEFT JOIN (
      SELECT
        proj.portfolio_id,
        SUM(COALESCE(v.planned_total, 0))::numeric                                    AS budget_planned,
        SUM(GREATEST(COALESCE(v.committed_total, 0), COALESCE(v.actual_total, 0)))::numeric AS budget_used
      FROM v_project_budget_summary v
      JOIN projects proj ON proj.id = v.project_id
      WHERE proj.portfolio_id IS NOT NULL
      GROUP BY proj.portfolio_id
    ) b ON b.portfolio_id = pf.id
    WHERE pf.organisation_id = ${profile.organisation_id}
    ORDER BY pf.name
  `) as unknown as Row[];

  // Apply RBAC server-side: keep portfolios this user is allowed to see.
  const rows = ctx
    ? allRows.filter((r) => canViewPortfolio(ctx, {
        organisation_id: r.organisation_id,
        access_mode: r.access_mode,
        allowed_entra_groups: r.allowed_entra_groups ?? [],
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Portfolios"
        description="Strategic containers grouping related projects. Each portfolio rolls up project health, budget, and initiative count."
        actions={<CreatePortfolioButton />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No portfolios yet"
          description="Portfolios are top-level transformation programmes (e.g. Project IRIS). They contain multiple projects, each with their own initiatives."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const used = Number(p.budget_used);
            const planned = Number(p.budget_planned);
            const pct = planned > 0 ? Math.round((used / planned) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={`/portfolios/${p.id}`}
                className="group flex flex-col rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow duration-normal ease-standard hover:shadow-md focus-visible:outline-none focus-visible:shadow-focus"
              >
                <div className="flex items-start gap-2">
                  <Layers className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold leading-snug text-fg1 truncate">
                      {p.name}
                    </h3>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-fg3">{p.code}</div>
                  </div>
                </div>

                {(p.division || p.department) && (
                  <div className="mt-2 text-[11px] text-fg3 line-clamp-2">
                    {p.division ?? "—"}{p.department ? ` · ${p.department}` : ""}
                  </div>
                )}

                {p.description && (
                  <p className="mt-2 text-[13px] leading-[1.5] text-fg3 line-clamp-2">
                    {p.description}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Projects"   value={Number(p.project_count)} sub={`${Number(p.active_count)} active`} />
                  <Stat label="Initiatives" value={Number(p.initiative_count)} />
                  <Stat label="Used"       value={`${pct}%`} sub={formatCurrency(used)} />
                </div>

                <div className="mt-3 flex items-center justify-between text-[12px] text-fg3">
                  <span>Total planned</span>
                  <span className="tabular text-fg2">{formatCurrency(planned)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-md bg-bg-muted py-2">
      <div className="text-[18px] font-bold tabular text-fg1 leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-fg3">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-fg3">{sub}</div>}
    </div>
  );
}
