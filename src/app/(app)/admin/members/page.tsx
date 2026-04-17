import { PageHeader } from "@/components/ui/page-header";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MembersAdmin() {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) redirect("/");

  const sb = supabaseServer();
  const { data: profiles } = await sb.from("profiles")
    .select("id, full_name, email, job_title, department, is_platform_admin")
    .eq("organisation_id", profile.organisation_id!)
    .order("full_name");

  return (
    <>
      <PageHeader title="Members directory" description="Every user registered in your organisation." />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Job title</th><th>Department</th><th>Platform admin</th></tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p: any) => (
              <tr key={p.id}>
                <td className="font-medium">{p.full_name ?? "—"}</td>
                <td className="text-slate-600">{p.email}</td>
                <td className="text-slate-600">{p.job_title ?? "—"}</td>
                <td className="text-slate-600">{p.department ?? "—"}</td>
                <td>{p.is_platform_admin ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
