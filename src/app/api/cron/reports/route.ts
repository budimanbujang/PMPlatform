import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { supabaseService } from "@/lib/supabase/server";
import { generateWeeklyReport } from "@/lib/reports/generate";
import { sendEmail } from "@/lib/email/resend";
import { isoWeekStart, isoWeekEnd, toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

  const sb = supabaseService();
  // The reporting week is the one that just closed — if run on Tuesday, use current ISO week Mon–Sun.
  const weekStart = toISODate(isoWeekStart());
  const weekEnd = toISODate(isoWeekEnd());

  const { data: projects } = await sb
    .from("projects")
    .select("id, code, name, organisation_id")
    .eq("status", "active");

  const results: Array<{ code: string; status: "ok" | "failed"; error?: string }> = [];

  for (const p of projects ?? []) {
    try {
      const { pdfPath } = await generateWeeklyReport({
        projectId: p.id,
        periodStart: weekStart,
        periodEnd: weekEnd,
        organisationId: p.organisation_id,
      });

      // Get TMO + IWC members to email the report to.
      const { data: recipients } = await sb
        .from("members")
        .select("profile_id, role, profiles(email, full_name)")
        .eq("project_id", p.id)
        .in("role", ["tmo", "iwc", "sponsor", "executive"]);

      const emails = (recipients ?? [])
        .map((r: any) => r.profiles?.email)
        .filter(Boolean) as string[];

      if (emails.length) {
        const { data: signed } = await sb.storage.from("reports").createSignedUrl(pdfPath, 60 * 60 * 24 * 7);
        const url = signed?.signedUrl;
        await sendEmail({
          to: emails,
          subject: `${p.code} Weekly Progress Report — ${weekStart}`,
          html: `<p>The weekly progress report for <b>${p.code} · ${p.name}</b> is ready.</p>
                 <p>Period: ${weekStart} → ${weekEnd}</p>
                 ${url ? `<p><a href="${url}" style="background:#0284c7;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;">Download PDF</a></p>` : ""}`,
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
