import { sql } from "@/lib/db";
import { MemberManager } from "./member-manager";

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: { id: string } }) {
  const [members, projectRows] = await Promise.all([
    sql`
      SELECT m.id, m.role, m.profile_id, m.is_active,
             p.email, p.full_name, p.job_title
      FROM members m
      LEFT JOIN profiles p ON p.id = m.profile_id
      WHERE m.project_id = ${params.id}
      ORDER BY p.full_name NULLS LAST
    `,
    sql`SELECT id, organisation_id FROM projects WHERE id = ${params.id} LIMIT 1`,
  ]);
  const project = projectRows[0] as any;

  return (
    <MemberManager
      projectId={params.id}
      organisationId={project?.organisation_id ?? ""}
      members={(members as any[]).map((m) => ({
        id: m.id,
        profile_id: m.profile_id,
        role: m.role,
        is_active: m.is_active,
        email: m.email ?? "",
        full_name: m.full_name ?? "",
        job_title: m.job_title ?? "",
      }))}
    />
  );
}
