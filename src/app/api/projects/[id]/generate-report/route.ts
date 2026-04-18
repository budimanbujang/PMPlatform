import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { generateWeeklyReport } from "@/lib/reports/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  period_start: z.string(),
  period_end: z.string(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await requireProfile();

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const rows = await sql`SELECT id, organisation_id FROM projects WHERE id = ${params.id} LIMIT 1`;
  const project = rows[0] as any;
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const out = await generateWeeklyReport({
      projectId: project.id,
      organisationId: project.organisation_id,
      periodStart: body.data.period_start,
      periodEnd: body.data.period_end,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "generation failed" }, { status: 500 });
  }
}
