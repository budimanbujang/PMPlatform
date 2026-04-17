import { supabaseServer } from "@/lib/supabase/server";
import { BudgetForm } from "./form";

export default async function NewBudgetLinePage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: project } = await sb.from("projects").select("id, organisation_id").eq("id", params.id).single();
  const { data: initiatives } = await sb.from("initiatives").select("id, code, name").eq("project_id", params.id);
  if (!project) return null;
  return (
    <BudgetForm
      projectId={project.id}
      organisationId={project.organisation_id}
      initiatives={initiatives ?? []}
    />
  );
}
