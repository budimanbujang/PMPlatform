import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { sql } from "@/lib/db";
import { callClaudeWithRetry } from "@/lib/ai/claude";
import { INSIGHT_DIGEST_SYSTEM } from "@/lib/ai/prompts";
import { isoWeekStart, toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

  const weekStart = toISODate(isoWeekStart());
  const orgs = await sql`SELECT id, name FROM organisations`;

  const output: Array<{ org: string; insights: number }> = [];

  for (const org of orgs as any[]) {
    const projects = await sql`
      SELECT id, code, name, rag, status, department
      FROM projects
      WHERE organisation_id = ${org.id} AND status = 'active'
    `;
    if ((projects as any[]).length === 0) continue;

    const projectIds = (projects as any[]).map((p) => p.id);
    const [subs, risks, deliverables] = await Promise.all([
      sql`SELECT * FROM submissions WHERE period_start = ${weekStart} AND project_id = ANY(${projectIds})`,
      sql`SELECT * FROM risks WHERE project_id = ANY(${projectIds}) AND status IN ('open','mitigating')`,
      sql`SELECT * FROM deliverables WHERE project_id = ANY(${projectIds}) AND status IN ('not_started','in_progress','blocked')`,
    ]);

    const payload = {
      period: weekStart,
      projects: (projects as any[]).map((p) => ({
        id: p.id, code: p.code, name: p.name, rag: p.rag, department: p.department,
        submissions:  (subs         as any[]).filter((s) => s.project_id === p.id),
        risks:        (risks        as any[]).filter((r) => r.project_id === p.id),
        deliverables: (deliverables as any[]).filter((d) => d.project_id === p.id),
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

    for (const i of parsed.insights) {
      await sql`
        INSERT INTO ai_insights (organisation_id, scope, kind, severity, headline, body_md, supporting_data)
        VALUES (
          ${org.id},
          'organisation',
          ${i.kind ?? 'pattern'},
          ${i.severity ?? 'info'},
          ${i.headline},
          ${i.body_md ?? null},
          ${i.supporting_data ? JSON.stringify(i.supporting_data) : null}::jsonb
        )
      `;
    }
    output.push({ org: org.name, insights: parsed.insights.length });
  }

  return NextResponse.json({ week: weekStart, output });
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try { return JSON.parse(raw); }
  catch { return null; }
}
