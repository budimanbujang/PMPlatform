// Compiles the structured JSON payload that is handed to Claude to produce
// the weekly report. Keep this layer deterministic — no AI here.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReportCompilation {
  project: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    department: string | null;
    cadence: string;
    rag: string;
  };
  period: { start: string; end: string };
  initiatives: Array<{
    id: string;
    code: string;
    name: string;
    rag: string;
    submission?: {
      status: string;
      progress_pct: number | null;
      headline: string | null;
      progress_notes: string | null;
      risks_text: string | null;
      issues_text: string | null;
      narrative: string | null;
      escalate: boolean;
      escalate_reason: string | null;
      submitted_at: string | null;
    } | null;
  }>;
  risks: Array<{ title: string; severity: string; likelihood: string; score: number; status: string; mitigation: string | null }>;
  deliverables: Array<{ title: string; status: string; due_date: string | null }>;
  budget: {
    planned: number;
    committed: number;
    actual: number;
    variance_pct: number;
    currency: string;
  } | null;
  escalations: Array<{ initiative_code: string; reason: string | null; headline: string | null }>;
}

export async function compileWeeklyReport(
  sb: SupabaseClient,
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ReportCompilation> {
  const { data: project } = await sb
    .from("projects")
    .select("id, code, name, description, department, cadence, rag")
    .eq("id", projectId)
    .single();
  if (!project) throw new Error("Project not found");

  const { data: initiatives } = await sb
    .from("initiatives")
    .select("id, code, name, rag")
    .eq("project_id", projectId)
    .order("sort_order");

  const initiativeIds = (initiatives ?? []).map((i) => i.id);

  const { data: submissions } = await sb
    .from("submissions")
    .select("*")
    .in("initiative_id", initiativeIds.length ? initiativeIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("period_start", periodStart);

  const subsByInit = new Map<string, any>();
  (submissions ?? []).forEach((s) => subsByInit.set(s.initiative_id, s));

  const { data: risks } = await sb
    .from("risks")
    .select("title, severity, likelihood, score, status, mitigation")
    .eq("project_id", projectId)
    .in("status", ["open", "mitigating"])
    .order("score", { ascending: false })
    .limit(15);

  const { data: deliverables } = await sb
    .from("deliverables")
    .select("title, status, due_date")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true })
    .limit(25);

  const { data: budget } = await sb
    .from("v_project_budget_summary")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const { data: budgetCurrency } = await sb
    .from("budget_lines")
    .select("currency")
    .eq("project_id", projectId)
    .limit(1)
    .maybeSingle();

  const initiativesCompiled = (initiatives ?? []).map((i) => {
    const sub = subsByInit.get(i.id);
    return {
      id: i.id, code: i.code, name: i.name, rag: i.rag,
      submission: sub ? {
        status: sub.status,
        progress_pct: sub.progress_pct,
        headline: sub.headline,
        progress_notes: sub.progress_notes,
        risks_text: sub.risks_text,
        issues_text: sub.issues_text,
        narrative: sub.narrative,
        escalate: sub.escalate,
        escalate_reason: sub.escalate_reason,
        submitted_at: sub.submitted_at,
      } : null,
    };
  });

  const escalations = initiativesCompiled
    .filter((i) => i.submission?.escalate)
    .map((i) => ({
      initiative_code: i.code,
      headline: i.submission?.headline ?? null,
      reason: i.submission?.escalate_reason ?? null,
    }));

  return {
    project: project as any,
    period: { start: periodStart, end: periodEnd },
    initiatives: initiativesCompiled,
    risks: (risks ?? []) as any,
    deliverables: (deliverables ?? []) as any,
    budget: budget ? {
      planned: Number(budget.planned_total ?? 0),
      committed: Number(budget.committed_total ?? 0),
      actual: Number(budget.actual_total ?? 0),
      variance_pct: Number(budget.variance_pct ?? 0),
      currency: budgetCurrency?.currency ?? "MYR",
    } : null,
    escalations,
  };
}
