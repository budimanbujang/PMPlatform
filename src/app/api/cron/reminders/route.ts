import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { isoWeekStart, isoWeekEnd, toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

  const weekStart = toISODate(isoWeekStart());
  const weekEnd = toISODate(isoWeekEnd());

  const projects = await sql`
    SELECT id, code, name, organisation_id FROM projects WHERE status = 'active'
  `;

  const sent: Array<{ project: string; initiative: string; to: string }> = [];

  for (const p of projects as any[]) {
    const initiatives = await sql`
      SELECT id, code, name, champion_id
      FROM initiatives
      WHERE project_id = ${p.id}
    `;
    const initIds = (initiatives as any[]).map((i) => i.id);
    if (initIds.length === 0) continue;

    const subs = await sql`
      SELECT initiative_id, status
      FROM submissions
      WHERE initiative_id = ANY(${initIds}) AND period_start = ${weekStart}
    `;
    const doneBy = new Map((subs as any[]).map((s) => [s.initiative_id, s.status]));

    for (const i of initiatives as any[]) {
      if (doneBy.get(i.id) === "submitted") continue;
      if (!i.champion_id) continue;

      const profileRows = await sql`
        SELECT email, full_name FROM profiles WHERE id = ${i.champion_id} LIMIT 1
      `;
      const profile = profileRows[0] as any;
      if (!profile?.email) continue;

      const url = `${process.env.NEXT_PUBLIC_APP_URL}/projects/${p.id}/submit?initiative=${i.id}&period=${weekStart}`;

      try {
        await sendEmail({
          to: profile.email,
          subject: `Reminder: ${p.code} submission due (${weekStart}–${weekEnd})`,
          html: `
            <p>Hi ${profile.full_name ?? "there"},</p>
            <p>Your weekly update for <b>${p.code} · ${p.name}</b> — initiative <b>${i.code} · ${i.name}</b> — is still outstanding.</p>
            <p>Period: ${weekStart} → ${weekEnd}</p>
            <p><a href="${url}" style="background:#b87d07;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;">Submit update</a></p>`,
          text: `Your weekly update for ${p.code} · ${i.code} is outstanding. Submit here: ${url}`,
        });
        sent.push({ project: p.code, initiative: i.code, to: profile.email });
      } catch (err) {
        console.error("reminder send failed", err);
      }
    }
  }

  return NextResponse.json({ sent, count: sent.length });
}
