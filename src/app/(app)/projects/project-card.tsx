import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BudgetBar } from "@/components/ui/budget-bar";
import { ProjectDeleteButton } from "./delete-button";

export type ProjectCardProps = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "on_hold" | "closed" | "archived";
  priority: "low" | "medium" | "high" | "critical";
  progressPercentage: number;
  budgetUsed: number;
  budgetTotal: number;
  currency?: string;
  tasksCompleted: number;
  tasksTotal: number;
  startDate: string | null;
  endDate: string | null;
  // True when the current user can hard-delete this project.
  // Drives the trash icon overlay; otherwise it isn't rendered.
  canDelete?: boolean;
};

// ─── Status (maps DB values → user-facing labels per the spec) ──────────
const statusMeta: Record<
  ProjectCardProps["status"],
  { label: string; dot: string; pill: string }
> = {
  draft: {
    label: "Not Started",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  },
  active: {
    label: "In Progress",
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
  },
  on_hold: {
    label: "On Hold",
    dot: "bg-orange-500",
    pill: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30",
  },
  closed: {
    label: "Completed",
    dot: "bg-green-500",
    pill: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30",
  },
  archived: {
    label: "Archived",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  },
};

const priorityMeta: Record<
  ProjectCardProps["priority"],
  { label: string; pill: string }
> = {
  low:      { label: "LOW",      pill: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700" },
  medium:   { label: "MEDIUM",   pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30" },
  high:     { label: "HIGH",     pill: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30" },
  critical: { label: "CRITICAL", pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30" },
};

export function ProjectCard(p: ProjectCardProps) {
  const status = statusMeta[p.status];
  const priority = priorityMeta[p.priority];
  const pct = Math.max(0, Math.min(100, Math.round(p.progressPercentage)));
  const currency = p.currency ?? "MYR";

  // Budget overspend warning — 95%+ of total used, or already over.
  const budgetOver = p.budgetTotal > 0 && p.budgetUsed / p.budgetTotal >= 0.95;

  return (
    <div className="group relative">
      {p.canDelete && (
        <ProjectDeleteButton projectId={p.id} projectName={p.name} />
      )}
    <Link
      href={`/projects/${p.id}`}
      className="flex flex-col rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow duration-normal ease-standard hover:shadow-md focus-visible:outline-none focus-visible:shadow-focus"
    >
      {/* Title row with status dot */}
      <div className="flex items-start gap-2">
        <span className={`mt-[7px] h-2 w-2 flex-none rounded-full ${status.dot}`} aria-hidden />
        <h3 className="text-[16px] font-bold leading-snug text-fg1">
          {p.name}
        </h3>
      </div>

      {/* Description */}
      {p.description && (
        <p className="mt-1.5 text-[13px] leading-[1.5] text-fg3 line-clamp-2">
          {p.description}
        </p>
      )}

      {/* Status + priority pills */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${status.pill}`}>
          {status.label}
        </span>
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${priority.pill}`}>
          {priority.label}
        </span>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[13px]">
          <span className="text-fg3">Progress</span>
          <span className="font-semibold tabular text-fg1">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-slow ease-standard dark:bg-blue-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="my-4 border-t border-border" />

      {/* Budget + Tasks */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-fg3">Budget</div>
          <div className={`mt-0.5 text-[13px] font-semibold tabular ${budgetOver ? "text-red-600 dark:text-red-400" : "text-fg1"}`}>
            {formatCurrency(p.budgetUsed, currency)}
            <span className="text-fg3 font-normal"> / {formatCurrency(p.budgetTotal, currency)}</span>
          </div>
          <BudgetBar
            used={p.budgetUsed}
            total={p.budgetTotal}
            className="mt-2"
            ariaLabel={`Budget consumption for ${p.name}`}
          />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-fg3">Tasks</div>
          <div className="mt-0.5 text-[13px] font-semibold tabular text-fg1">
            {p.tasksCompleted} / {p.tasksTotal}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wider text-fg3">Timeline</div>
        <div className="mt-0.5 text-[13px] font-semibold text-fg1">
          {formatDate(p.startDate)} <span className="text-fg3">→</span> {formatDate(p.endDate)}
        </div>
      </div>
    </Link>
    </div>
  );
}
