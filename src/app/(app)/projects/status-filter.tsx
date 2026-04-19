import Link from "next/link";
import { cn } from "@/lib/utils";

const filters = [
  { key: "",        label: "All" },
  { key: "draft",   label: "Not Started" },
  { key: "active",  label: "In Progress" },
  { key: "on_hold", label: "On Hold" },
  { key: "closed",  label: "Completed" },
];

export function ProjectStatusFilter({
  activeStatus,
  counts,
}: {
  activeStatus: string;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => {
        const active = activeStatus === f.key || (f.key === "" && !activeStatus);
        const count = f.key === "" ? counts.total : (counts[f.key] ?? 0);
        return (
          <Link
            key={f.key || "all"}
            href={f.key ? `/projects?status=${f.key}` : "/projects"}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-fast",
              active
                ? "bg-brand-600 text-white border-brand-600 hover:bg-brand-700"
                : "bg-surface text-fg2 border-border hover:bg-bg-muted",
            )}
          >
            {f.label}
            <span
              className={cn(
                "tabular text-[11px] rounded-full px-1.5 py-0.5",
                active ? "bg-white/20 text-white" : "bg-bg-muted text-fg3",
              )}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
