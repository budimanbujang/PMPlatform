import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { generateWeeklyReport } from "@/lib/reports/generate";

const schema = z.object({
  period_start: z.string(),
  period_end: z.string(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await requireProfile();
  const sb = supabaseServer();

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const { data: project, error } = await sb
    .from("projects").select("id, organisation_id")
    .eq("id", params.id).single();
  if (error || !project) return NextResponse.json({ error: "not found" }, { status: 404 });

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
