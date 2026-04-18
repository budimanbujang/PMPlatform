import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RagBadge } from "@/components/ui/rag-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { status?: string; dept?: string; rag?: string };
}) {
  const profile = await requireProfile();
  const orgId = profile.organisation_id;
  const { status, rag, dept } = searchParams;

  const rows = await sql`
    SELECT id, code, name, department, status, rag, cadence, sponsor_id, start_date, target_end_date
    FROM projects
    WHERE organisation_id = ${orgId}
      AND (${status ?? null}::text IS NULL OR status::text = ${status ?? null})
      AND (${rag ?? null}::text    IS NULL OR rag::text    = ${rag ?? null})
      AND (${dept ?? null}::text   IS NULL OR department   = ${dept ?? null})
    ORDER BY updated_at DESC
  `;
  const items = rows as unknown as Project[];

  return (
    <>
      <PageHeader
        title="Project register"
        description="Every project registered across JCorp HoldCo. Filter by status, department, or RAG."
        actions={
          <Link href="/projects/new" className="btn-primary">
            <Plus className="mr-1.5 h-4 w-4" /> New project
          </Link>
        }
      />

      <Filters />

      {items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Create the first project or adjust your filters."
          action={<Link href="/projects/new" className="btn-primary">Create project</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Status</th>
                <th>RAG</th>
                <th>Cadence</th>
                <th>Target end</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.code}</td>
                  <td>
                    <Link href={`/projects/${p.id}`} className="font-medium">
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.department ?? "—"}</td>
                  <td className="capitalize">{p.status.replace("_", " ")}</td>
                  <td><RagBadge rag={p.rag} /></td>
                  <td className="capitalize">{p.cadence}</td>
                  <td>{formatDate(p.target_end_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Filters() {
  return (
    <form className="mb-4 flex flex-wrap gap-2">
      <select name="status" className="input w-auto" defaultValue="">
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="on_hold">On hold</option>
        <option value="closed">Closed</option>
        <option value="archived">Archived</option>
      </select>
      <select name="rag" className="input w-auto" defaultValue="">
        <option value="">All RAG</option>
        <option value="green">Green</option>
        <option value="amber">Amber</option>
        <option value="red">Red</option>
        <option value="grey">Pending</option>
      </select>
      <input name="dept" placeholder="Department" className="input w-48" />
      <button type="submit" className="btn-secondary">Filter</button>
    </form>
  );
}
