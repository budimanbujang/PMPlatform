import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { callClaudeWithRetry } from "@/lib/ai/claude";
import { INSIGHT_DIGEST_SYSTEM } from "@/lib/ai/prompts";
import { isoWeekStart, toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const profile = await requireProfile();
    if (!profile.organisation_id) {
      return NextResponse.json({ error: "Profile not attached to an organisation" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured on the server" },
        { status: 500 },
      );
    }

    const sb = supabaseService();
    const weekStart = toISODate(isoWeekStart());

    const { data: projects, error: projErr } = await sb.from("projects")
      .select("id, code, name, rag, department, status")
      .eq("organisation_id", profile.organisation_id)
      .eq("status", "active");

    if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 });
    if (!projects?.length) return NextResponse.json({ count: 0, insights: [], note: "No active projects to analyse." });

    const projectIds = projects.map((p) => p.id);
    const [subsRes, risksRes, delivRes] = await Promise.all([
      sb.from("submissions").select("*").eq("period_start", weekStart).in("project_id", projectIds),
      sb.from("risks").select("*").in("project_id", projectIds).in("status", ["open", "mitigating"]),
      sb.from("deliverables").select("*").in("project_id", projectIds).in("status", ["not_started", "in_progress", "blocked"]),
    ]);

    const payload = {
      period: weekStart,
      projects: projects.map((p) => ({
        ...p,
        submissions: (subsRes.data ?? []).filter((s) => s.project_id === p.id),
        risks: (risksRes.data ?? []).filter((r) => r.project_id === p.id),
        deliverables: (delivRes.data ?? []).filter((d) => d.project_id === p.id),
      })),
    };

    let aiText: string;
    try {
      const aiRes = await callClaudeWithRetry({
        system: INSIGHT_DIGEST_SYSTEM,
        cacheableSystem: true,
        user: `Portfolio snapshot JSON:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\nReturn only the JSON described.`,
        maxTokens: 2500,
        temperature: 0.1,
      });
      aiText = aiRes.text;
    } catch (e: any) {
      return NextResponse.json(
        { error: `Claude API call failed: ${e?.message ?? String(e)}` },
        { status: 502 },
      );
    }

    const parsed = extractJson(aiText);
    if (!parsed?.insights?.length) {
      return NextResponse.json({
        count: 0,
        insights: [],
        note: "Claude found no actionable insights for the current portfolio snapshot.",
      });
    }

    const rows = parsed.insights.map((i: any) => ({
      organisation_id: profile.organisation_id!,
      scope: "organisation" as const,
      kind: i.kind ?? "pattern",
      severity: i.severity ?? "info",
      headline: String(i.headline ?? "Untitled insight").slice(0, 500),
      body_md: i.body_md ?? null,
      supporting_data: i.supporting_data ?? null,
    }));

    const { error: insertErr } = await sb.from("ai_insights").insert(rows);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ count: rows.length, insights: rows });
  } catch (e: any) {
    // Top-level safety net — clients should always receive JSON, not an HTML
    // error page that would produce "Unexpected end of JSON input".
    console.error("[/api/insights/generate] unhandled:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error" },
      { status: 500 },
    );
  }
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  try {
    return JSON.parse(fenced ? fenced[1] : text);
  } catch {
    return null;
  }
}
