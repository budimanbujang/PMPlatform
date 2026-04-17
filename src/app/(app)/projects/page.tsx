import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RagBadge } from "@/components/ui/rag-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { status?: string; dept?: string; rag?: string };
}) {
  const sb = supabaseServer();
  let q = sb.from("projects")
    .select("id, code, name, department, status, rag, cadence, sponsor_id, start_date, target_end_date")
    .order("updated_at", { ascending: false });
  if (searchParams.status) q = q.eq("status", searchParams.status);
  if (searchParams.dept)   q = q.eq("department", searchParams.dept);
  if (searchParams.rag)    q = q.eq("rag", searchParams.rag);

  const { data: projects } = await q;
  const items = (projects ?? []) as Project[];

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
                    <Link href={`/projects/${p.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="text-slate-600">{p.department ?? "—"}</td>
                  <td className="capitalize text-slate-600">{p.status.replace("_", " ")}</td>
                  <td><RagBadge rag={p.rag} /></td>
                  <td className="capitalize text-slate-600">{p.cadence}</td>
                  <td className="text-slate-600">{formatDate(p.target_end_date)}</td>
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
