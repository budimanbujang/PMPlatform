import { supabaseServer } from "@/lib/supabase/server";
import { MemberManager } from "./member-manager";

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const [{ data: members }, { data: project }] = await Promise.all([
    sb.from("members")
      .select("id, role, profile_id, is_active, profiles(email, full_name, job_title)")
      .eq("project_id", params.id),
    sb.from("projects").select("id, organisation_id").eq("id", params.id).single(),
  ]);

  return (
    <MemberManager
      projectId={params.id}
      organisationId={project?.organisation_id ?? ""}
      members={(members ?? []).map((m: any) => ({
        id: m.id,
        profile_id: m.profile_id,
        role: m.role,
        is_active: m.is_active,
        email: m.profiles?.email ?? "",
        full_name: m.profiles?.full_name ?? "",
        job_title: m.profiles?.job_title ?? "",
      }))}
    />
  );
}
