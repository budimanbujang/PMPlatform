// Fallback page shown when env vars are missing — avoids a white-screen on
// first deploy. Once NEXT_PUBLIC_SUPABASE_URL is set, middleware stops
// redirecting here.

export default function SetupPage() {
  // Supabase URL + anon key can be set under two naming conventions:
  //   1. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (manual)
  //   2. SUPABASE_URL / SUPABASE_ANON_KEY (Vercel-Supabase integration)
  // next.config.mjs aliases (2) → (1) at build time.
  const supaUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supaAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const checks = [
    { name: "Supabase URL", ok: !!supaUrl,
      hint: "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL via integration)" },
    { name: "Supabase anon key", ok: !!supaAnon,
      hint: "NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)" },
    { name: "Supabase service role", ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hint: "SUPABASE_SERVICE_ROLE_KEY (secret)" },
    { name: "Anthropic API key", ok: !!process.env.ANTHROPIC_API_KEY,
      hint: "ANTHROPIC_API_KEY (secret)" },
    { name: "Resend API key", ok: !!process.env.RESEND_API_KEY,
      hint: "RESEND_API_KEY (optional for dev)" },
    { name: "Cron secret", ok: !!process.env.CRON_SECRET,
      hint: "CRON_SECRET (openssl rand -hex 32)" },
  ];

  const missingCritical = !supaUrl || !supaAnon || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">JCorp PMO — Setup needed</h1>
        <p className="mt-2 text-sm text-slate-600">
          One or more required environment variables are missing. Set them in
          Vercel → Settings → Environment Variables → apply to <b>Production, Preview
          and Development</b>, then redeploy.
        </p>

        <table className="mt-5 w-full text-sm">
          <tbody>
            {checks.map((c) => (
              <tr key={c.name} className="border-t border-slate-100">
                <td className="py-2 align-top">
                  <div className="font-medium">{c.name}</div>
                  <div className="font-mono text-xs text-slate-500">{c.hint}</div>
                </td>
                <td className="py-2 text-right align-top">
                  {c.ok ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">set</span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">missing</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!missingCritical && (
          <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Critical Supabase vars look set, but this page is still showing — that
            usually means the change hasn't been deployed yet. Click <b>Redeploy</b>
            in Vercel to rebuild with the new env.
          </p>
        )}

        <p className="mt-6 text-xs text-slate-500">
          See <code className="rounded bg-slate-100 px-1">DEPLOY.md</code> in the repo
          for the full walkthrough.
        </p>
      </div>
    </div>
  );
}
