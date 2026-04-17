import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { isoWeekStart, isoWeekEnd, toISODate } from "@/lib/utils";
import { SubmissionForm } from "./submission-form";
import type { Project, SubmissionTemplate, Initiative, Submission } from "@/types/database";

export default async function SubmitPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { initiative?: string; period?: string };
}) {
  const profile = await requireProfile();
  const sb = supabaseServer();

  const { data: project } = await sb
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!project) notFound();
  const p = project as Project;

  const { data: initiatives } = await sb
    .from("initiatives")
    .select("id, code, name, champion_id")
    .eq("project_id", p.id)
    .order("sort_order");

  const tplQuery = p.template_id
    ? sb.from("submission_templates").select("*").eq("id", p.template_id).single()
    : sb.from("submission_templates").select("*").eq("is_default", true).limit(1).single();
  const { data: template } = await tplQuery;
  if (!template) redirect(`/projects/${p.id}`);

  const list = (initiatives ?? []) as Initiative[];
  const initiativeId = searchParams.initiative ?? list[0]?.id;

  const periodStart = searchParams.period ?? toISODate(isoWeekStart());
  const periodEnd = toISODate(isoWeekEnd(new Date(periodStart)));

  // Look up existing submission for this initiative + period
  const { data: existing } = initiativeId
    ? await sb.from("submissions")
        .select("*")
        .eq("initiative_id", initiativeId)
        .eq("period_start", periodStart)
        .maybeSingle()
    : { data: null as Submission | null };

  return (
    <>
      <PageHeader
        title="Submit weekly update"
        description={`${p.code} · ${p.name}`}
      />
      <SubmissionForm
        project={p}
        template={template as SubmissionTemplate}
        initiatives={list}
        initiativeId={initiativeId}
        periodStart={periodStart}
        periodEnd={periodEnd}
        existing={(existing as Submission) ?? null}
        profileId={profile.id}
      />
    </>
  );
}
