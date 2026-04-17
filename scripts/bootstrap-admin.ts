// Promote a user to platform_admin and attach them to an organisation.
// Run once after your first login, e.g.:
//   pnpm tsx scripts/bootstrap-admin.ts --email budi@jcorp.my
//
// Safe to re-run. Does nothing if the user is already admin.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function arg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = arg("email");
  if (!email) {
    console.error("usage: pnpm tsx scripts/bootstrap-admin.ts --email you@jcorp.my");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing Supabase env vars");

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: profile, error: findErr } = await sb
    .from("profiles")
    .select("id, email, organisation_id, is_platform_admin")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (findErr) throw findErr;
  if (!profile) {
    console.error(`No profile for ${email}. Sign in once at /login first.`);
    process.exit(1);
  }

  // Decide which org to attach if missing: prefer email-domain match, else first.
  let orgId = profile.organisation_id;
  if (!orgId) {
    const domain = email.split("@")[1]?.toLowerCase();
    const { data: org } = await sb.from("organisations").select("id, name, domain").eq("domain", domain).maybeSingle();
    if (org) orgId = org.id;
    else {
      const { data: first } = await sb.from("organisations").select("id").limit(1).maybeSingle();
      orgId = first?.id ?? null;
    }
  }

  if (!orgId) {
    console.error("No organisation exists yet. Run supabase/seed/iris.sql first.");
    process.exit(1);
  }

  const { error: updErr } = await sb
    .from("profiles")
    .update({ organisation_id: orgId, is_platform_admin: true })
    .eq("id", profile.id);
  if (updErr) throw updErr;

  console.log(`✓ ${email} is now platform admin of org ${orgId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
