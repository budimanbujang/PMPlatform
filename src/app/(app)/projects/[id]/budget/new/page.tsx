import { sql } from "@/lib/db";
import { BudgetForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewBudgetLinePage({ params }: { params: { id: string } }) {
  const [projectRows, initiatives] = await Promise.all([
    sql`SELECT id, organisation_id FROM projects WHERE id = ${params.id} LIMIT 1`,
    sql`SELECT id, code, name FROM initiatives WHERE project_id = ${params.id} ORDER BY sort_order`,
  ]);
  const project = projectRows[0] as any;
  if (!project) return null;

  return (
    <BudgetForm
      projectId={project.id}
      organisationId={project.organisation_id}
      initiatives={initiatives as any[]}
    />
  );
}
