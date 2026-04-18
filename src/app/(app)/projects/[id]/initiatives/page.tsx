import { sql } from "@/lib/db";
import { InitiativeManager } from "./initiative-manager";

export const dynamic = "force-dynamic";

export default async function InitiativesPage({ params }: { params: { id: string } }) {
  const [initiatives, projectRows, members] = await Promise.all([
    sql`SELECT * FROM initiatives WHERE project_id = ${params.id} ORDER BY sort_order`,
    sql`SELECT id, organisation_id FROM projects WHERE id = ${params.id} LIMIT 1`,
    sql`
      SELECT m.profile_id, p.full_name, p.email
      FROM members m LEFT JOIN profiles p ON p.id = m.profile_id
      WHERE m.project_id = ${params.id}
    `,
  ]);
  const project = projectRows[0] as any;

  return (
    <InitiativeManager
      projectId={params.id}
      organisationId={project?.organisation_id ?? ""}
      initiatives={initiatives as any[]}
      owners={(members as any[]).map((m) => ({
        profile_id: m.profile_id,
        name: m.full_name ?? m.email ?? "User",
      }))}
    />
  );
}
