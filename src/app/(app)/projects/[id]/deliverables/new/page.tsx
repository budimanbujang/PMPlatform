import { sql } from "@/lib/db";
import { DeliverableForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewDeliverablePage({ params }: { params: { id: string } }) {
  const [projectRows, initiatives, members, milestones] = await Promise.all([
    sql`SELECT id, organisation_id, name FROM projects WHERE id = ${params.id} LIMIT 1`,
    sql`SELECT id, code, name FROM initiatives WHERE project_id = ${params.id} ORDER BY sort_order`,
    sql`
      SELECT m.profile_id, p.full_name, p.email
      FROM members m LEFT JOIN profiles p ON p.id = m.profile_id
      WHERE m.project_id = ${params.id}
    `,
    sql`SELECT id, name, target_date FROM milestones WHERE project_id = ${params.id} ORDER BY target_date`,
  ]);
  const project = projectRows[0] as any;
  if (!project) return null;

  return (
    <DeliverableForm
      projectId={project.id}
      organisationId={project.organisation_id}
      initiatives={initiatives as any[]}
      milestones={milestones as any[]}
      members={(members as any[]).map((m) => ({
        profile_id: m.profile_id,
        name: m.full_name ?? m.email ?? "User",
      }))}
    />
  );
}
