import { sql } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/utils";
import { GenerateReportButton } from "./generate-button";
import { ReportDownload } from "./download-link";
import type { ReportRun } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ params }: { params: { id: string } }) {
  const runs = (await sql`
    SELECT * FROM report_runs
    WHERE project_id = ${params.id}
    ORDER BY period_start DESC
  `) as unknown as ReportRun[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg3">
          Weekly reports are generated every Tuesday at 14:00 MYT. You can also generate on demand below.
        </p>
        <GenerateReportButton projectId={params.id} />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Status</th>
              <th>Model</th>
              <th>Tokens</th>
              <th>Generated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.period_start)} – {formatDate(r.period_end)}</td>
                <td className="capitalize">{r.status}</td>
                <td className="text-xs font-mono">{r.ai_model ?? "—"}</td>
                <td className="text-xs tabular text-fg3">
                  {r.ai_input_tokens ?? 0} in / {r.ai_output_tokens ?? 0} out
                </td>
                <td>{formatDateTime(r.completed_at)}</td>
                <td>
                  {r.pdf_path ? <ReportDownload pdfPath={r.pdf_path} /> :
                    r.error_message ? <span className="text-xs text-red-600 dark:text-red-400">{r.error_message}</span> : "—"}
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-fg3">No reports yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
