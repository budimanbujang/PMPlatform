import { supabaseServer } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";
import { GenerateReportButton } from "./generate-button";
import { ReportDownload } from "./download-link";
import type { ReportRun } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: runs } = await sb
    .from("report_runs")
    .select("*")
    .eq("project_id", params.id)
    .order("period_start", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
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
            {(runs as ReportRun[] | null)?.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.period_start)} – {formatDate(r.period_end)}</td>
                <td className="capitalize">{r.status}</td>
                <td className="text-xs font-mono">{r.ai_model ?? "—"}</td>
                <td className="text-xs tabular-nums text-slate-600">
                  {r.ai_input_tokens ?? 0} in / {r.ai_output_tokens ?? 0} out
                </td>
                <td className="text-slate-600">{formatDateTime(r.completed_at)}</td>
                <td>
                  {r.pdf_path ? <ReportDownload pdfPath={r.pdf_path} /> :
                    r.error_message ? <span className="text-xs text-red-600">{r.error_message}</span> : "—"}
                </td>
              </tr>
            ))}
            {!runs?.length && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">No reports yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
