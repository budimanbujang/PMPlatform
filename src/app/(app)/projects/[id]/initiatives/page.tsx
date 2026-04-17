import { supabaseServer } from "@/lib/supabase/server";
import { InitiativeManager } from "./initiative-manager";

export const dynamic = "force-dynamic";

export default async function InitiativesPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const [{ data: initiatives }, { data: project }, { data: members }] = await Promise.all([
    sb.from("initiatives").select("*").eq("project_id", params.id).order("sort_order"),
    sb.from("projects").select("id, organisation_id").eq("id", params.id).single(),
    sb.from("members").select("profile_id, profiles(full_name, email)").eq("project_id", params.id),
  ]);

  return (
    <InitiativeManager
      projectId={params.id}
      organisationId={project?.organisation_id ?? ""}
      initiatives={initiatives ?? []}
      owners={(members ?? []).map((m: any) => ({
        profile_id: m.profile_id,
        name: m.profiles?.full_name ?? m.profiles?.email ?? "User",
      }))}
    />
  );
}
