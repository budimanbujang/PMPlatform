// Compiles the structured JSON payload that is handed to Claude to produce
// the weekly report. Deterministic — no AI here.

import { sql } from "@/lib/db";

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
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ReportCompilation> {
  const [projectRows, initiatives, risks, deliverables, budgetRows, currencyRows] = await Promise.all([
    sql`SELECT id, code, name, description, department, cadence, rag FROM projects WHERE id = ${projectId} LIMIT 1`,
    sql`SELECT id, code, name, rag FROM initiatives WHERE project_id = ${projectId} ORDER BY sort_order`,
    sql`
      SELECT title, severity, likelihood, score, status, mitigation
      FROM risks
      WHERE project_id = ${projectId} AND status IN ('open', 'mitigating')
      ORDER BY score DESC LIMIT 15
    `,
    sql`
      SELECT title, status, due_date
      FROM deliverables
      WHERE project_id = ${projectId}
      ORDER BY due_date NULLS LAST LIMIT 25
    `,
    sql`SELECT * FROM v_project_budget_summary WHERE project_id = ${projectId} LIMIT 1`,
    sql`SELECT currency FROM budget_lines WHERE project_id = ${projectId} LIMIT 1`,
  ]);

  const project = projectRows[0] as any;
  if (!project) throw new Error("Project not found");

  const initiativeIds = (initiatives as any[]).map((i) => i.id);
  const submissions = initiativeIds.length
    ? await sql`
        SELECT * FROM submissions
        WHERE initiative_id = ANY(${initiativeIds})
          AND period_start = ${periodStart}
      `
    : [];

  const subsByInit = new Map<string, any>();
  (submissions as any[]).forEach((s) => subsByInit.set(s.initiative_id, s));

  const initiativesCompiled = (initiatives as any[]).map((i) => {
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

  const budget = budgetRows[0] as any;
  const currency = (currencyRows[0] as any)?.currency ?? "MYR";

  return {
    project,
    period: { start: periodStart, end: periodEnd },
    initiatives: initiativesCompiled,
    risks: risks as any,
    deliverables: deliverables as any,
    budget: budget ? {
      planned:      Number(budget.planned_total ?? 0),
      committed:    Number(budget.committed_total ?? 0),
      actual:       Number(budget.actual_total ?? 0),
      variance_pct: Number(budget.variance_pct ?? 0),
      currency,
    } : null,
    escalations,
  };
}
