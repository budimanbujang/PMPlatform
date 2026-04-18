// Ties together: compile → Claude → PDF → Azure Blob → DB.
// Invoked from the cron endpoint and the manual "Generate now" button.

import { sql } from "@/lib/db";
import { callClaudeWithRetry } from "@/lib/ai/claude";
import { WEEKLY_REPORT_SYSTEM } from "@/lib/ai/prompts";
import { uploadBlob } from "@/lib/storage/azure-blob";
import { compileWeeklyReport } from "./compiler";
import { renderWeeklyReportPdf } from "./pdf";

export async function generateWeeklyReport(params: {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  organisationId: string;
}) {
  // Insert or update a queued run record first — so retries are idempotent.
  const [run] = await sql`
    INSERT INTO report_runs (organisation_id, project_id, period_start, period_end, status)
    VALUES (
      ${params.organisationId}, ${params.projectId},
      ${params.periodStart}, ${params.periodEnd},
      'generating'
    )
    ON CONFLICT (project_id, period_start) DO UPDATE SET
      status = 'generating',
      error_message = NULL,
      period_end = EXCLUDED.period_end
    RETURNING id
  `;
  const runId = run.id as string;

  try {
    const compiled = await compileWeeklyReport(params.projectId, params.periodStart, params.periodEnd);

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
    await uploadBlob({
      which: "reports",
      path: pdfPath,
      data: pdfBytes,
      contentType: "application/pdf",
    });

    await sql`
      UPDATE report_runs
      SET status = 'succeeded',
          narrative_md = ${aiResult.text},
          pdf_path = ${pdfPath},
          input_payload = ${JSON.stringify(compiled)}::jsonb,
          ai_model = ${aiResult.model},
          ai_input_tokens = ${aiResult.input_tokens},
          ai_output_tokens = ${aiResult.output_tokens},
          ai_latency_ms = ${aiResult.latency_ms},
          completed_at = now(),
          error_message = NULL
      WHERE id = ${runId}
    `;

    return { runId, pdfPath, narrativeMd: aiResult.text };
  } catch (e: any) {
    await sql`
      UPDATE report_runs
      SET status = 'failed',
          error_message = ${e?.message ?? String(e)},
          completed_at = now()
      WHERE id = ${runId}
    `;
    throw e;
  }
}
