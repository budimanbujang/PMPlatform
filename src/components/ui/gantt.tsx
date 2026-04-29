// =============================================================================
// Lightweight CSS-grid Gantt chart. Server-renderable, no chart library.
//
// Each row = one entity (project or initiative). The horizontal axis is a
// month-by-month timeline computed from min(start) .. max(end) across rows.
// Bars are placed via percentage offsets so they reflow correctly at any
// container width.
//
// Use:
//   <Gantt rows={[{ id, label, sub, start, end, status, rag, href? }, ...]} />
// =============================================================================

import Link from "next/link";

export interface GanttRow {
  id: string;
  label: string;
  sub?: string;        // smaller text under the label (e.g. project code)
  start: string | null;
  end: string | null;
  status?: "draft" | "active" | "on_hold" | "closed" | "archived";
  rag?: "green" | "amber" | "red" | "grey";
  href?: string;       // makes the label cell a link
}

const ragColor: Record<NonNullable<GanttRow["rag"]>, string> = {
  green: "bg-green-500 dark:bg-green-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  red:   "bg-red-500   dark:bg-red-400",
  grey:  "bg-slate-400 dark:bg-slate-500",
};
const statusColor: Record<NonNullable<GanttRow["status"]>, string> = {
  draft:    "bg-slate-400 dark:bg-slate-500",
  active:   "bg-blue-500 dark:bg-blue-400",
  on_hold:  "bg-orange-500 dark:bg-orange-400",
  closed:   "bg-green-500 dark:bg-green-400",
  archived: "bg-slate-300 dark:bg-slate-600",
};

export function Gantt({
  rows,
  emptyMessage = "Add start and target-end dates to see the timeline.",
}: {
  rows: GanttRow[];
  emptyMessage?: string;
}) {
  // Filter rows missing dates — they can't be plotted but show in the legend.
  const dated = rows.filter((r) => r.start && r.end);
  if (dated.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg-subtle p-6 text-center text-sm text-fg3">
        {emptyMessage}
      </div>
    );
  }

  // Compute the timeline range. Snap start to month start, end to month end.
  const startTimes = dated.map((r) => new Date(r.start!).getTime());
  const endTimes   = dated.map((r) => new Date(r.end!).getTime());
  const minStart = new Date(Math.min(...startTimes));
  const maxEnd   = new Date(Math.max(...endTimes));
  const rangeStart = startOfMonth(minStart);
  const rangeEnd   = endOfMonth(maxEnd);
  const totalMs    = rangeEnd.getTime() - rangeStart.getTime();
  if (totalMs <= 0) return null;

  const months = monthsBetween(rangeStart, rangeEnd);
  const today = new Date();
  const todayPct =
    today >= rangeStart && today <= rangeEnd
      ? ((today.getTime() - rangeStart.getTime()) / totalMs) * 100
      : null;

  return (
    <div className="rounded-md border border-border bg-surface overflow-hidden">
      {/* Month axis header */}
      <div className="grid bg-bg-subtle border-b border-border" style={{ gridTemplateColumns: `220px 1fr` }}>
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-fg3 border-r border-border">
          Item
        </div>
        <div className="relative flex">
          {months.map((m, i) => (
            <div
              key={i}
              className="flex-1 border-r border-border last:border-r-0 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-fg3"
            >
              {m.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
            </div>
          ))}
        </div>
      </div>

      {/* Body rows */}
      <div className="divide-y divide-border">
        {rows.map((r) => {
          const start = r.start ? new Date(r.start) : null;
          const end = r.end ? new Date(r.end) : null;
          const hasBar = start && end && totalMs > 0;
          const left = hasBar
            ? ((start!.getTime() - rangeStart.getTime()) / totalMs) * 100
            : 0;
          const width = hasBar
            ? Math.max(((end!.getTime() - start!.getTime()) / totalMs) * 100, 1.2)
            : 0;
          const fill =
            r.rag    ? ragColor[r.rag] :
            r.status ? statusColor[r.status] :
                       "bg-brand-600";

          return (
            <div key={r.id} className="grid items-stretch" style={{ gridTemplateColumns: `220px 1fr` }}>
              <div className="border-r border-border px-3 py-2.5">
                {r.href ? (
                  <Link href={r.href} className="block min-w-0 hover:underline">
                    <div className="truncate text-[13px] font-semibold text-fg1">{r.label}</div>
                    {r.sub && <div className="truncate text-[11px] text-fg3">{r.sub}</div>}
                  </Link>
                ) : (
                  <>
                    <div className="truncate text-[13px] font-semibold text-fg1">{r.label}</div>
                    {r.sub && <div className="truncate text-[11px] text-fg3">{r.sub}</div>}
                  </>
                )}
              </div>
              <div className="relative h-12">
                {/* Month grid lines */}
                {months.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-r border-border/60"
                    style={{ left: `${(i + 1) * (100 / months.length)}%` }}
                  />
                ))}

                {/* Today line */}
                {todayPct !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-brand-500/70"
                    style={{ left: `${todayPct}%` }}
                    title={`Today: ${today.toLocaleDateString("en-GB")}`}
                  />
                )}

                {/* The bar */}
                {hasBar && (
                  <div
                    className={`absolute top-1/2 h-3.5 -translate-y-1/2 rounded ${fill} shadow-sm`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${r.label}: ${formatShortDate(start!)} → ${formatShortDate(end!)}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
function monthsBetween(a: Date, b: Date): Date[] {
  const out: Date[] = [];
  const cur = startOfMonth(a);
  while (cur <= b) {
    out.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}
function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
