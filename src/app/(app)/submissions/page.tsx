import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RagBadge } from "@/components/ui/rag-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MySubmissionsPage() {
  const profile = await requireProfile();
  const sb = supabaseServer();

  const { data: memberships } = await sb.from("members")
    .select("project_id, initiative_id, role")
    .eq("profile_id", profile.id)
    .in("role", ["champion", "io"]);

  const initiativeIds = Array.from(new Set(
    (memberships ?? []).map((m) => m.initiative_id).filter(Boolean) as string[],
  ));

  const { data } = await sb.from("submissions")
    .select("*, project:projects(id, code, name), initiative:initiatives(id, code, name)")
    .order("period_start", { ascending: false })
    .limit(50);

  const mine = ((data ?? []) as any[]).filter((s) =>
    s.submitted_by === profile.id || initiativeIds.includes(s.initiative_id),
  );

  return (
    <>
      <PageHeader title="My submissions" description="Past and current updates you're responsible for." />
      {mine.length === 0 ? (
        <EmptyState icon={FileText} title="No submissions yet" description="Your Champion/IO work will appear here." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Period</th><th>Project</th><th>Initiative</th><th>RAG</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {mine.map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.period_start)} – {formatDate(s.period_end)}</td>
                  <td><Link href={`/projects/${s.project?.id}`} className="text-brand-700 hover:underline">{s.project?.code}</Link></td>
                  <td className="text-slate-600">{s.initiative?.code ?? "—"}</td>
                  <td><RagBadge rag={s.rag} /></td>
                  <td className="capitalize">{s.status}</td>
                  <td className="text-right">
                    <Link href={`/projects/${s.project?.id}/submit?initiative=${s.initiative?.id}&period=${s.period_start}`} className="text-sm text-brand-700 hover:underline">
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
