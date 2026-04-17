import { supabaseServer } from "@/lib/supabase/server";
import { DeliverableForm } from "./form";

export default async function NewDeliverablePage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: project } = await sb.from("projects")
    .select("id, organisation_id, name")
    .eq("id", params.id).single();
  const { data: initiatives } = await sb.from("initiatives")
    .select("id, code, name").eq("project_id", params.id).order("sort_order");
  const { data: members } = await sb.from("members")
    .select("profile_id, role, profiles(full_name, email)")
    .eq("project_id", params.id);
  const { data: milestones } = await sb.from("milestones")
    .select("id, name, target_date").eq("project_id", params.id).order("target_date");

  if (!project) return null;

  return (
    <DeliverableForm
      projectId={project.id}
      organisationId={project.organisation_id}
      initiatives={initiatives ?? []}
      milestones={milestones ?? []}
      members={(members ?? []).map((m: any) => ({
        profile_id: m.profile_id,
        name: m.profiles?.full_name ?? m.profiles?.email ?? "User",
      }))}
    />
  );
}
