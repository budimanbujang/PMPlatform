import Link from "next/link";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyDeliverablesPage() {
  const profile = await requireProfile();

  const rows = await sql`
    SELECT
      d.id, d.title, d.status, d.due_date,
      p.id AS project_id, p.code AS project_code
    FROM deliverables d
    JOIN projects p ON p.id = d.project_id
    WHERE d.owner_id = ${profile.id}
    ORDER BY d.due_date NULLS LAST
  `;

  return (
    <>
      <PageHeader title="My deliverables" description="Everything assigned to you across every project." />
      {rows.length === 0 ? (
        <EmptyState icon={Target} title="No deliverables owned by you" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Title</th><th>Project</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((d: any) => {
                const overdue = d.due_date && new Date(d.due_date) < new Date()
                  && !["complete", "cancelled"].includes(d.status);
                return (
                  <tr key={d.id}>
                    <td className="font-medium">{d.title}</td>
                    <td>
                      <Link href={`/projects/${d.project_id}`} className="card-link">
                        {d.project_code}
                      </Link>
                    </td>
                    <td className={overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>{formatDate(d.due_date)}</td>
                    <td className="capitalize">{d.status.replace("_", " ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
