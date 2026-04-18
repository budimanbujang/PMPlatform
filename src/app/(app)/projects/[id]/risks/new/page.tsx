import { sql } from "@/lib/db";
import { RiskForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewRiskPage({ params }: { params: { id: string } }) {
  const [projectRows, members] = await Promise.all([
    sql`SELECT id, organisation_id FROM projects WHERE id = ${params.id} LIMIT 1`,
    sql`
      SELECT m.profile_id, p.full_name, p.email
      FROM members m LEFT JOIN profiles p ON p.id = m.profile_id
      WHERE m.project_id = ${params.id}
    `,
  ]);
  const project = projectRows[0] as any;
  if (!project) return null;

  return (
    <RiskForm
      projectId={project.id}
      organisationId={project.organisation_id}
      owners={(members as any[]).map((m) => ({
        profile_id: m.profile_id,
        name: m.full_name ?? m.email ?? "User",
      }))}
    />
  );
}
