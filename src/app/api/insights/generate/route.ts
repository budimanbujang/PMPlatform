import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { callClaudeWithRetry } from "@/lib/ai/claude";
import { INSIGHT_DIGEST_SYSTEM } from "@/lib/ai/prompts";
import { isoWeekStart, toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const profile = await requireProfile();
  if (!profile.organisation_id) return NextResponse.json({ error: "no org" }, { status: 400 });

  const sb = supabaseService();
  const weekStart = toISODate(isoWeekStart());

  const { data: projects } = await sb.from("projects")
    .select("id, code, name, rag, department, status")
    .eq("organisation_id", profile.organisation_id).eq("status", "active");

  if (!projects?.length) return NextResponse.json({ count: 0, insights: [] });

  const projectIds = projects.map((p) => p.id);
  const [{ data: subs }, { data: risks }, { data: deliverables }] = await Promise.all([
    sb.from("submissions").select("*").eq("period_start", weekStart).in("project_id", projectIds),
    sb.from("risks").select("*").in("project_id", projectIds).in("status", ["open","mitigating"]),
    sb.from("deliverables").select("*").in("project_id", projectIds).in("status", ["not_started","in_progress","blocked"]),
  ]);

  const payload = {
    period: weekStart,
    projects: projects.map((p) => ({
      ...p,
      submissions: (subs ?? []).filter((s) => s.project_id === p.id),
      risks: (risks ?? []).filter((r) => r.project_id === p.id),
      deliverables: (deliverables ?? []).filter((d) => d.project_id === p.id),
    })),
  };

  const res = await callClaudeWithRetry({
    system: INSIGHT_DIGEST_SYSTEM,
    cacheableSystem: true,
    user: `Portfolio snapshot JSON:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\nReturn only the JSON described.`,
    maxTokens: 2500,
    temperature: 0.1,
  });

  const parsed = extractJson(res.text);
  if (!parsed?.insights?.length) {
    return NextResponse.json({ count: 0, insights: [] });
  }

  const rows = parsed.insights.map((i: any) => ({
    organisation_id: profile.organisation_id!,
    scope: "organisation" as const,
    kind: i.kind,
    severity: i.severity ?? "info",
    headline: i.headline,
    body_md: i.body_md,
    supporting_data: i.supporting_data ?? null,
  }));

  const { error } = await sb.from("ai_insights").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: rows.length, insights: rows });
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  try { return JSON.parse(fenced ? fenced[1] : text); } catch { return null; }
}
