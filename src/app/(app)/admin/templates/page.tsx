import { PageHeader } from "@/components/ui/page-header";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TemplatesAdmin() {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) redirect("/");

  const templates = await sql`
    SELECT * FROM submission_templates
    WHERE organisation_id = ${profile.organisation_id}
    ORDER BY is_default DESC, name
  `;

  return (
    <>
      <PageHeader
        title="Submission templates"
        description="Templates define the form modules that Champions fill in each period."
      />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Modules</th><th>Default</th><th>Updated</th></tr></thead>
          <tbody>
            {(templates as any[]).map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.name}</td>
                <td>{(t.modules ?? []).map((m: any) => m.key).join(", ")}</td>
                <td>{t.is_default ? "✓" : ""}</td>
                <td className="text-xs text-fg3">{t.updated_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-fg3">
        Template editing UI lands in a later phase — for now, edit templates directly in the database.
      </p>
    </>
  );
}
