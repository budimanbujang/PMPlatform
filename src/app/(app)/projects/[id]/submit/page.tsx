import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { isoWeekStart, isoWeekEnd, toISODate } from "@/lib/utils";
import { SubmissionForm } from "./submission-form";
import type { Project, SubmissionTemplate, Initiative, Submission } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SubmitPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { initiative?: string; period?: string };
}) {
  const profile = await requireProfile();

  const projectRows = await sql`SELECT * FROM projects WHERE id = ${params.id} LIMIT 1`;
  const p = projectRows[0] as unknown as Project | undefined;
  if (!p) notFound();

  const initiatives = (await sql`
    SELECT id, code, name, champion_id
    FROM initiatives
    WHERE project_id = ${p.id}
    ORDER BY sort_order
  `) as unknown as Initiative[];

  const templateRows = p.template_id
    ? await sql`SELECT * FROM submission_templates WHERE id = ${p.template_id} LIMIT 1`
    : await sql`SELECT * FROM submission_templates WHERE is_default = true LIMIT 1`;
  const template = templateRows[0] as unknown as SubmissionTemplate | undefined;
  if (!template) redirect(`/projects/${p.id}`);

  const initiativeId = searchParams.initiative ?? initiatives[0]?.id;
  const periodStart = searchParams.period ?? toISODate(isoWeekStart());
  const periodEnd = toISODate(isoWeekEnd(new Date(periodStart)));

  const existing = initiativeId
    ? ((await sql`
        SELECT * FROM submissions
        WHERE initiative_id = ${initiativeId}
          AND period_start = ${periodStart}
        LIMIT 1
      `)[0] as unknown as Submission | undefined) ?? null
    : null;

  return (
    <>
      <PageHeader title="Submit weekly update" description={`${p.code} · ${p.name}`} />
      <SubmissionForm
        project={p}
        template={template}
        initiatives={initiatives}
        initiativeId={initiativeId}
        periodStart={periodStart}
        periodEnd={periodEnd}
        existing={existing}
        profileId={profile.id}
      />
    </>
  );
}
