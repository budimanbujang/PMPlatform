import { PageHeader } from "@/components/ui/page-header";
import { ProjectWizard } from "./project-wizard";
import { supabaseServer } from "@/lib/supabase/server";

export default async function NewProjectPage() {
  const sb = supabaseServer();
  const [{ data: templates }, { data: portfolios }, { data: programmes }] = await Promise.all([
    sb.from("submission_templates").select("id, name, is_default").order("is_default", { ascending: false }),
    sb.from("portfolios").select("id, code, name").order("name"),
    sb.from("programmes").select("id, code, name, portfolio_id").order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Register a new project"
        description="Projects join the platform via configuration — no code changes required."
      />
      <ProjectWizard
        templates={templates ?? []}
        portfolios={portfolios ?? []}
        programmes={programmes ?? []}
      />
    </>
  );
}
