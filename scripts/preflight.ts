// Preflight — run after deploy to verify every external dependency is wired up.
// Usage:  pnpm tsx scripts/preflight.ts
//
// Does not mutate production data. Reads + one no-op Claude call.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const checks: Array<{ name: string; run: () => Promise<string> }> = [];
const results: Array<{ name: string; status: "ok" | "fail"; detail: string }> = [];

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing ${name}`);
  return v;
}

// ---- 1. Env vars -----------------------------------------------------------
checks.push({
  name: "env vars",
  run: async () => {
    const required = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "ANTHROPIC_API_KEY",
      "CRON_SECRET",
      "NEXT_PUBLIC_APP_URL",
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
    return "all required env vars set";
  },
});

// ---- 2. Supabase DB --------------------------------------------------------
checks.push({
  name: "supabase db",
  run: async () => {
    const sb = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const { data, error } = await sb.from("organisations").select("id, name").limit(1);
    if (error) throw error;
    return data?.length ? `ok — found org "${data[0].name}"` : "ok — but no organisations seeded yet";
  },
});

// ---- 3. Supabase storage buckets ------------------------------------------
checks.push({
  name: "storage buckets",
  run: async () => {
    const sb = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const wanted = ["project-documents", "reports"];
    const { data, error } = await sb.storage.listBuckets();
    if (error) throw error;
    const names = new Set(data.map((b) => b.name));
    const missing = wanted.filter((w) => !names.has(w));
    if (missing.length) throw new Error(`missing buckets: ${missing.join(", ")}`);
    return `ok — ${wanted.join(", ")}`;
  },
});

// ---- 4. Claude API ---------------------------------------------------------
checks.push({
  name: "claude api",
  run: async () => {
    const client = new Anthropic({ apiKey: need("ANTHROPIC_API_KEY") });
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 16,
      messages: [{ role: "user", content: 'Reply with the single word: "pong".' }],
    });
    const text = res.content.find((b) => b.type === "text")?.text ?? "";
    if (!text.toLowerCase().includes("pong")) throw new Error(`unexpected: ${text}`);
    return `ok — ${res.usage.input_tokens} in / ${res.usage.output_tokens} out tokens`;
  },
});

// ---- 5. Resend (optional) --------------------------------------------------
checks.push({
  name: "resend api key",
  run: async () => {
    if (!process.env.RESEND_API_KEY) return "skipped — RESEND_API_KEY not set (optional)";
    // Use /domains endpoint; it validates the key without sending email.
    const res = await fetch("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = (await res.json()) as { data?: Array<{ name: string; status: string }> };
    const domains = (json.data ?? []).map((d) => `${d.name}(${d.status})`).join(", ");
    return `ok — domains: ${domains || "none yet"}`;
  },
});

// ---- 6. App HTTP health ----------------------------------------------------
checks.push({
  name: "app /api/health",
  run: async () => {
    const base = need("NEXT_PUBLIC_APP_URL");
    const r = await fetch(`${base}/api/health`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j = await r.json();
    return `ok — ${j.service} @ ${j.timestamp}`;
  },
});

// ---- run -------------------------------------------------------------------
(async () => {
  for (const c of checks) {
    try {
      const detail = await c.run();
      results.push({ name: c.name, status: "ok", detail });
      console.log(`✓ ${c.name.padEnd(24)} ${detail}`);
    } catch (e: any) {
      results.push({ name: c.name, status: "fail", detail: e?.message ?? String(e) });
      console.log(`✗ ${c.name.padEnd(24)} ${e?.message ?? e}`);
    }
  }
  const fails = results.filter((r) => r.status === "fail").length;
  console.log(`\n${fails === 0 ? "All green." : `${fails} check(s) failed.`}`);
  process.exit(fails === 0 ? 0 : 1);
})();
