import { PageHeader } from "@/components/ui/page-header";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MembersAdmin() {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) redirect("/");

  const rows = await sql`
    SELECT id, full_name, email, job_title, department, is_platform_admin
    FROM profiles
    WHERE organisation_id = ${profile.organisation_id}
    ORDER BY full_name NULLS LAST
  `;

  return (
    <>
      <PageHeader title="Members directory" description="Every user registered in your organisation." />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Job title</th><th>Department</th><th>Platform admin</th></tr>
          </thead>
          <tbody>
            {(rows as any[]).map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.full_name ?? "—"}</td>
                <td>{p.email}</td>
                <td>{p.job_title ?? "—"}</td>
                <td>{p.department ?? "—"}</td>
                <td>{p.is_platform_admin ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
