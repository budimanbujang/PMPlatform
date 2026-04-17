import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { supabaseService } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { isoWeekStart, isoWeekEnd, toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;

  const sb = supabaseService();
  const weekStart = toISODate(isoWeekStart());
  const weekEnd = toISODate(isoWeekEnd());

  // For every active project, find initiatives missing a submitted submission
  const { data: projects } = await sb
    .from("projects")
    .select("id, code, name, organisation_id")
    .eq("status", "active");

  const sent: Array<{ project: string; initiative: string; to: string }> = [];

  for (const p of projects ?? []) {
    const { data: initiatives } = await sb
      .from("initiatives")
      .select("id, code, name, champion_id")
      .eq("project_id", p.id);

    const initIds = (initiatives ?? []).map((i) => i.id);
    if (!initIds.length) continue;

    const { data: subs } = await sb
      .from("submissions")
      .select("initiative_id, status")
      .in("initiative_id", initIds)
      .eq("period_start", weekStart);

    const doneBy = new Map((subs ?? []).map((s) => [s.initiative_id, s.status]));

    for (const i of initiatives ?? []) {
      const status = doneBy.get(i.id);
      if (status === "submitted") continue;

      if (!i.champion_id) continue;
      const { data: profile } = await sb
        .from("profiles").select("email, full_name").eq("id", i.champion_id).single();
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
            <p><a href="${url}" style="background:#0284c7;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;">Submit update</a></p>
            <p style="color:#64748b;font-size:12px;">You're receiving this because you're the Champion for this initiative.</p>`,
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
