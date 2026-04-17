import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TemplatesAdmin() {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) redirect("/");
  const sb = supabaseServer();
  const { data: templates } = await sb.from("submission_templates").select("*").order("is_default", { ascending: false });

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
            {(templates ?? []).map((t: any) => (
              <tr key={t.id}>
                <td className="font-medium">{t.name}</td>
                <td className="text-slate-600">{(t.modules ?? []).map((m: any) => m.key).join(", ")}</td>
                <td>{t.is_default ? "✓" : ""}</td>
                <td className="text-slate-500 text-xs">{t.updated_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Template editing UI lands in Phase 1.1 — for now, edit templates directly via the Supabase studio.
      </p>
    </>
  );
}
