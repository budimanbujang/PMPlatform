import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { supabaseService } from "@/lib/supabase/server";
import { callClaudeWithRetry } from "@/lib/ai/claude";
import { INSIGHT_DIGEST_SYSTEM } from "@/lib/ai/prompts";
import { isoWeekStart, toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

  const sb = supabaseService();
  const weekStart = toISODate(isoWeekStart());

  const { data: orgs } = await sb.from("organisations").select("id, name");

  const output: Array<{ org: string; insights: number }> = [];

  for (const org of orgs ?? []) {
    const { data: projects } = await sb.from("projects")
      .select("id, code, name, rag, status, department").eq("organisation_id", org.id)
      .eq("status", "active");
    if (!projects?.length) continue;

    const projectIds = projects.map((p) => p.id);
    const [{ data: submissions }, { data: risks }, { data: deliverables }] = await Promise.all([
      sb.from("submissions")
        .select("project_id, initiative_id, rag, status, headline, narrative, escalate, progress_pct")
        .eq("period_start", weekStart)
        .in("project_id", projectIds),
      sb.from("risks")
        .select("project_id, title, severity, likelihood, score, status")
        .in("project_id", projectIds)
        .in("status", ["open", "mitigating"]),
      sb.from("deliverables")
        .select("project_id, title, status, due_date")
        .in("project_id", projectIds)
        .in("status", ["not_started", "in_progress", "blocked"]),
    ]);

    const payload = {
      period: weekStart,
      projects: projects.map((p) => ({
        id: p.id, code: p.code, name: p.name, rag: p.rag, department: p.department,
        submissions: (submissions ?? []).filter((s) => s.project_id === p.id),
        risks: (risks ?? []).filter((r) => r.project_id === p.id),
        deliverables: (deliverables ?? []).filter((d) => d.project_id === p.id),
      })),
    };

    let parsed: any;
    try {
      const res = await callClaudeWithRetry({
        system: INSIGHT_DIGEST_SYSTEM,
        cacheableSystem: true,
        user: `Here is the portfolio snapshot JSON:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\nReturn only the JSON described in the system prompt.`,
        maxTokens: 2500,
        temperature: 0.1,
      });
      parsed = extractJson(res.text);
    } catch (e) {
      console.error("insight generation failed for org", org.id, e);
      continue;
    }

    if (!parsed?.insights?.length) continue;

    const rows = parsed.insights.map((i: any) => ({
      organisation_id: org.id,
      scope: "organisation",
      scope_id: null,
      kind: i.kind ?? "pattern",
      severity: i.severity ?? "info",
      headline: i.headline,
      body_md: i.body_md,
      supporting_data: i.supporting_data ?? null,
    }));

    await sb.from("ai_insights").insert(rows);
    output.push({ org: org.name, insights: rows.length });
  }

  return NextResponse.json({ week: weekStart, output });
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try { return JSON.parse(raw); }
  catch { return null; }
}
