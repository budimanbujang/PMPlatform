import { PageHeader } from "@/components/ui/page-header";
import { ProjectWizard } from "./project-wizard";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: { portfolio?: string };
}) {
  const profile = await requireProfile();
  const orgId = profile.organisation_id;

  const [templates, portfolios, programmes] = await Promise.all([
    sql`SELECT id, name, is_default FROM submission_templates WHERE organisation_id = ${orgId} ORDER BY is_default DESC`,
    sql`SELECT id, code, name FROM portfolios WHERE organisation_id = ${orgId} ORDER BY name`,
    sql`SELECT id, code, name, portfolio_id FROM programmes WHERE organisation_id = ${orgId} ORDER BY name`,
  ]);

  return (
    <>
      <PageHeader
        title="Register a new project"
        description="Add a project under the chosen portfolio. Use the back link to pick a different portfolio."
      />
      <ProjectWizard
        templates={templates as any[]}
        portfolios={portfolios as any[]}
        programmes={programmes as any[]}
        defaultPortfolioId={searchParams.portfolio ?? ""}
      />
    </>
  );
}
