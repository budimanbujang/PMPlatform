import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { sql } from "@/lib/db";
import { generateWeeklyReport } from "@/lib/reports/generate";
import { sendEmail } from "@/lib/email/resend";
import { signedReadUrl } from "@/lib/storage/azure-blob";
import { isoWeekStart, isoWeekEnd, toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

  const weekStart = toISODate(isoWeekStart());
  const weekEnd = toISODate(isoWeekEnd());

  const projects = await sql`
    SELECT id, code, name, organisation_id
    FROM projects
    WHERE status = 'active'
  `;

  const results: Array<{ code: string; status: "ok" | "failed"; error?: string }> = [];

  for (const p of projects as any[]) {
    try {
      const { pdfPath } = await generateWeeklyReport({
        projectId: p.id,
        periodStart: weekStart,
        periodEnd: weekEnd,
        organisationId: p.organisation_id,
      });

      const recipients = await sql`
        SELECT DISTINCT pf.email
        FROM members m
        JOIN profiles pf ON pf.id = m.profile_id
        WHERE m.project_id = ${p.id}
          AND m.role IN ('tmo', 'iwc', 'sponsor', 'executive')
          AND pf.email IS NOT NULL
      `;

      const emails = (recipients as any[]).map((r) => r.email).filter(Boolean);

      if (emails.length) {
        // 7-day SAS URL for the emailed link (aligns with Supabase behaviour).
        const url = signedReadUrl("reports", pdfPath, { expiresInSeconds: 60 * 60 * 24 * 7 });
        await sendEmail({
          to: emails,
          subject: `${p.code} Weekly Progress Report — ${weekStart}`,
          html: `<p>The weekly progress report for <b>${p.code} · ${p.name}</b> is ready.</p>
                 <p>Period: ${weekStart} → ${weekEnd}</p>
                 <p><a href="${url}" style="background:#b87d07;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;">Download PDF</a></p>`,
        });
      }

      results.push({ code: p.code, status: "ok" });
    } catch (e: any) {
      console.error("report generation failed for", p.code, e);
      results.push({ code: p.code, status: "failed", error: e?.message });
    }
  }

  return NextResponse.json({ week: weekStart, results });
}
