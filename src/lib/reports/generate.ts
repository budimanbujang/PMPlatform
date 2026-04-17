// Ties together: compile → Claude → PDF → Storage → DB.
// Invoked from the cron endpoint and the manual "Generate now" button.

import { supabaseService } from "@/lib/supabase/server";
import { callClaudeWithRetry } from "@/lib/ai/claude";
import { WEEKLY_REPORT_SYSTEM } from "@/lib/ai/prompts";
import { compileWeeklyReport } from "./compiler";
import { renderWeeklyReportPdf } from "./pdf";

export async function generateWeeklyReport(params: {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  organisationId: string;
}) {
  const sb = supabaseService();

  // Insert or update a queued run record first — so retries are idempotent.
  const { data: run, error: runErr } = await sb
    .from("report_runs")
    .upsert({
      organisation_id: params.organisationId,
      project_id: params.projectId,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      status: "generating",
    }, { onConflict: "project_id,period_start" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  try {
    const compiled = await compileWeeklyReport(sb as any, params.projectId, params.periodStart, params.periodEnd);

    const aiResult = await callClaudeWithRetry({
      system: WEEKLY_REPORT_SYSTEM,
      cacheableSystem: true,
      user: `Produce the weekly report. Here is the structured payload as JSON:\n\n\`\`\`json\n${JSON.stringify(compiled, null, 2)}\n\`\`\``,
      maxTokens: 3200,
      temperature: 0.2,
    });

    const pdfBytes = await renderWeeklyReportPdf({
      compiled,
      narrativeMd: aiResult.text,
      generatedAt: new Date(),
    });

    const pdfPath = `${params.organisationId}/${params.projectId}/${params.periodStart}/weekly-report.pdf`;
    const up = await sb.storage.from("reports").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) throw up.error;

    await sb.from("report_runs").update({
      status: "succeeded",
      narrative_md: aiResult.text,
      pdf_path: pdfPath,
      input_payload: compiled as any,
      ai_model: aiResult.model,
      ai_input_tokens: aiResult.input_tokens,
      ai_output_tokens: aiResult.output_tokens,
      ai_latency_ms: aiResult.latency_ms,
      completed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", run.id);

    return { runId: run.id, pdfPath, narrativeMd: aiResult.text };
  } catch (e: any) {
    await sb.from("report_runs").update({
      status: "failed",
      error_message: e?.message ?? String(e),
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    throw e;
  }
}
