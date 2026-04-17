import { RiskForm } from "./form";
import { supabaseServer } from "@/lib/supabase/server";

export default async function NewRiskPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: project } = await sb.from("projects").select("id, organisation_id").eq("id", params.id).single();
  const { data: members } = await sb.from("members")
    .select("profile_id, profiles(full_name, email)").eq("project_id", params.id);
  if (!project) return null;
  return (
    <RiskForm
      projectId={project.id}
      organisationId={project.organisation_id}
      owners={(members ?? []).map((m: any) => ({
        profile_id: m.profile_id,
        name: m.profiles?.full_name ?? m.profiles?.email ?? "User",
      }))}
    />
  );
}
