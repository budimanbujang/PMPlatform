import Link from "next/link";
import { Target, Plus } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { DeliverableActions } from "./actions-menu";
import type { Deliverable } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DeliverablesPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data } = await sb.from("deliverables")
    .select("*, owner:profiles!deliverables_owner_id_fkey(full_name, email)")
    .eq("project_id", params.id)
    .order("due_date", { nullsFirst: false });

  const items = (data ?? []) as (Deliverable & { owner?: { full_name: string; email: string } })[];
  const overdueCount = items.filter((d) =>
    d.due_date && new Date(d.due_date) < new Date() &&
    !["complete", "cancelled"].includes(d.status)
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {items.length} total · <span className="text-red-600 font-medium">{overdueCount} overdue</span>
        </div>
        <Link href={`/projects/${params.id}/deliverables/new`} className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" /> Add deliverable
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No deliverables yet"
          description="Deliverables tie work to a person, date, and evidence. They appear in every weekly report."
          action={<Link href={`/projects/${params.id}/deliverables/new`} className="btn-primary">Add first deliverable</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const overdue = d.due_date && new Date(d.due_date) < new Date() &&
                  !["complete", "cancelled"].includes(d.status);
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="font-medium">{d.title}</div>
                      {d.description && <div className="text-xs text-slate-500 line-clamp-1">{d.description}</div>}
                    </td>
                    <td className="text-slate-700">{d.owner?.full_name ?? d.owner?.email ?? "—"}</td>
                    <td className={overdue ? "text-red-600 font-medium" : "text-slate-600"}>{formatDate(d.due_date)}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="text-right"><DeliverableActions deliverableId={d.id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    not_started: "bg-slate-100 text-slate-700 border-slate-300",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    blocked:     "bg-red-50 text-red-700 border-red-200",
    complete:    "bg-green-50 text-green-700 border-green-200",
    cancelled:   "bg-slate-100 text-slate-500 border-slate-300 line-through",
  };
  return <span className={`badge ${map[status] ?? ""} capitalize`}>{status.replace("_", " ")}</span>;
}
