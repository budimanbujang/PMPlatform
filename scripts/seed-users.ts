// Seeds 20 placeholder IRIS users via Supabase Auth admin API.
// Requires SUPABASE_SERVICE_ROLE_KEY. Idempotent — safe to re-run.
//
// Usage:  tsx scripts/seed-users.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const IRIS_USERS = [
  { email: "tmo.lead@jcorp.my",        full_name: "Aina Yusof",       role: "tmo"      },
  { email: "iwc.chair@jcorp.my",       full_name: "Dato' Ramli",      role: "iwc"      },
  { email: "sponsor.iris@jcorp.my",    full_name: "Zainal Abidin",    role: "sponsor"  },
  { email: "pmo.iris@jcorp.my",        full_name: "Budi",             role: "pmo"      },
  { email: "champ.phi01@jcorp.my",     full_name: "Siti Nurhaliza",   role: "champion" },
  { email: "champ.phi02@jcorp.my",     full_name: "Kamarul",          role: "champion" },
  { email: "champ.fin01@jcorp.my",     full_name: "Joanne Tan",       role: "champion" },
  { email: "champ.ops01@jcorp.my",     full_name: "Ravi Kumar",       role: "champion" },
  { email: "champ.cps01@jcorp.my",     full_name: "Haris",            role: "champion" },
  { email: "champ.str01@jcorp.my",     full_name: "Melissa Lim",      role: "champion" },
  { email: "champ.dat01@jcorp.my",     full_name: "Arjun Das",        role: "champion" },
  { email: "champ.per01@jcorp.my",     full_name: "Nurul Ain",        role: "champion" },
];

const IRIS_PROJECT_ID = "40000000-0000-0000-0000-000000000001";
const IRIS_ORG_ID     = "00000000-0000-0000-0000-000000000001";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Env vars missing");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  for (const u of IRIS_USERS) {
    const { data: existing } = await sb.auth.admin.listUsers();
    const already = existing.users.find((x) => x.email === u.email);

    let id = already?.id;
    if (!already) {
      const { data, error } = await sb.auth.admin.createUser({
        email: u.email,
        email_confirm: true,
        password: crypto.randomUUID(),   // reset via magic link in practice
        user_metadata: { full_name: u.full_name },
      });
      if (error) { console.warn("skip", u.email, error.message); continue; }
      id = data.user?.id;
    }
    if (!id) continue;

    await sb.from("profiles").update({
      organisation_id: IRIS_ORG_ID, full_name: u.full_name,
    }).eq("id", id);

    await sb.from("members").upsert({
      organisation_id: IRIS_ORG_ID,
      project_id: IRIS_PROJECT_ID,
      profile_id: id,
      role: u.role,
    }, { onConflict: "project_id,profile_id,role,initiative_id" });

    console.log("✓", u.email);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
