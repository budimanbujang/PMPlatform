import Link from "next/link";
import { Target, Plus } from "lucide-react";
import { sql } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { DeliverableActions } from "./actions-menu";

export const dynamic = "force-dynamic";

export default async function DeliverablesPage({ params }: { params: { id: string } }) {
  const items = (await sql`
    SELECT
      d.id, d.title, d.description, d.status, d.due_date,
      p.full_name AS owner_name, p.email AS owner_email
    FROM deliverables d
    LEFT JOIN profiles p ON p.id = d.owner_id
    WHERE d.project_id = ${params.id}
    ORDER BY d.due_date NULLS LAST
  `) as any[];

  const overdueCount = items.filter((d) =>
    d.due_date && new Date(d.due_date) < new Date()
    && !["complete", "cancelled"].includes(d.status)
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-fg3">
          {items.length} total · <span className="text-red-600 dark:text-red-400 font-medium">{overdueCount} overdue</span>
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
                      {d.description && <div className="text-xs text-fg3 line-clamp-1">{d.description}</div>}
                    </td>
                    <td>{d.owner_name ?? d.owner_email ?? "—"}</td>
                    <td className={overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>{formatDate(d.due_date)}</td>
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
  const cls: Record<string, string> = {
    not_started: "rag-grey",
    in_progress: "rag-amber",
    blocked:     "rag-red",
    complete:    "rag-green",
    cancelled:   "rag-grey",
  };
  return <span className={`pill ${cls[status] ?? "rag-grey"} capitalize`}>{status.replace("_", " ")}</span>;
}
