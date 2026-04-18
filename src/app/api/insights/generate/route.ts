import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
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

    const orgId = profile.organisation_id;
    const weekStart = toISODate(isoWeekStart());

    const projects = await sql`
      SELECT id, code, name, rag, department, status
      FROM projects
      WHERE organisation_id = ${orgId} AND status = 'active'
    `;
    if (projects.length === 0) {
      return NextResponse.json({ count: 0, insights: [], note: "No active projects to analyse." });
    }

    const projectIds = projects.map((p: any) => p.id);
    const [subs, risks, deliverables] = await Promise.all([
      sql`SELECT * FROM submissions WHERE period_start = ${weekStart} AND project_id = ANY(${projectIds})`,
      sql`SELECT * FROM risks WHERE project_id = ANY(${projectIds}) AND status IN ('open','mitigating')`,
      sql`SELECT * FROM deliverables WHERE project_id = ANY(${projectIds}) AND status IN ('not_started','in_progress','blocked')`,
    ]);

    const payload = {
      period: weekStart,
      projects: (projects as any[]).map((p) => ({
        ...p,
        submissions:  (subs         as any[]).filter((s) => s.project_id === p.id),
        risks:        (risks        as any[]).filter((r) => r.project_id === p.id),
        deliverables: (deliverables as any[]).filter((d) => d.project_id === p.id),
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

    // Bulk insert insights
    let inserted = 0;
    for (const i of parsed.insights) {
      await sql`
        INSERT INTO ai_insights (organisation_id, scope, kind, severity, headline, body_md, supporting_data)
        VALUES (
          ${orgId},
          'organisation',
          ${i.kind ?? 'pattern'},
          ${i.severity ?? 'info'},
          ${String(i.headline ?? 'Untitled insight').slice(0, 500)},
          ${i.body_md ?? null},
          ${i.supporting_data ? JSON.stringify(i.supporting_data) : null}::jsonb
        )
      `;
      inserted++;
    }

    return NextResponse.json({ count: inserted, insights: parsed.insights });
  } catch (e: any) {
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
