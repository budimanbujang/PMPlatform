import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { supabaseServer } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function EnterpriseRisksPage() {
  const sb = supabaseServer();
  const { data } = await sb.from("risks")
    .select("id, title, severity, likelihood, score, status, project:projects(id, code, name)")
    .in("status", ["open", "mitigating"])
    .order("score", { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader title="Enterprise risk heatmap" description="Top risks across every active JCorp project." />
      {!data?.length ? (
        <EmptyState icon={AlertTriangle} title="No open risks" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Risk</th><th>Project</th><th>Severity</th><th>Likelihood</th><th>Score</th><th>Status</th></tr></thead>
            <tbody>
              {(data as any[]).map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.title}</td>
                  <td>
                    <Link href={`/projects/${r.project?.id}`} className="text-brand-700 hover:underline">
                      {r.project?.code}
                    </Link>
                  </td>
                  <td className="capitalize">{r.severity}</td>
                  <td className="capitalize">{r.likelihood.replace("_"," ")}</td>
                  <td>
                    <span className={`badge ${r.score >= 12 ? "bg-red-50 text-red-700 border-red-200" : r.score >= 6 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
                      {r.score}
                    </span>
                  </td>
                  <td className="capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
