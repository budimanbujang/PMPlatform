import Link from "next/link";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyDeliverablesPage() {
  const profile = await requireProfile();
  const sb = supabaseServer();

  const { data } = await sb
    .from("deliverables")
    .select("id, title, status, due_date, project:projects(id, code, name)")
    .eq("owner_id", profile.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  return (
    <>
      <PageHeader title="My deliverables" description="Everything assigned to you across every project." />
      {!data?.length ? (
        <EmptyState icon={Target} title="No deliverables owned by you" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Title</th><th>Project</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {(data as any[]).map((d) => {
                const overdue = d.due_date && new Date(d.due_date) < new Date() &&
                  !["complete", "cancelled"].includes(d.status);
                return (
                  <tr key={d.id}>
                    <td className="font-medium">{d.title}</td>
                    <td>
                      <Link href={`/projects/${d.project?.id}`} className="text-brand-700 hover:underline">
                        {d.project?.code}
                      </Link>
                    </td>
                    <td className={overdue ? "text-red-600 font-medium" : "text-slate-600"}>{formatDate(d.due_date)}</td>
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
