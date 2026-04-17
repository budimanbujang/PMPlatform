// Fallback page shown when env vars are missing — avoids a white-screen on
// first deploy. Once NEXT_PUBLIC_SUPABASE_URL is set, middleware stops
// redirecting here.

export default function SetupPage() {
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const checks = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", ok: hasSupabaseUrl },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", ok: hasSupabaseKey },
    { name: "SUPABASE_SERVICE_ROLE_KEY", ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: "ANTHROPIC_API_KEY", ok: !!process.env.ANTHROPIC_API_KEY },
    { name: "RESEND_API_KEY", ok: !!process.env.RESEND_API_KEY },
    { name: "CRON_SECRET", ok: !!process.env.CRON_SECRET },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">JCorp PMO — Setup needed</h1>
        <p className="mt-2 text-sm text-slate-600">
          This deployment is missing one or more required environment variables.
          Set them in your hosting dashboard (Vercel → Settings → Environment Variables)
          and redeploy.
        </p>

        <table className="mt-5 w-full text-sm">
          <tbody>
            {checks.map((c) => (
              <tr key={c.name} className="border-t border-slate-100">
                <td className="py-2 font-mono text-xs">{c.name}</td>
                <td className="py-2 text-right">
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

        <p className="mt-6 text-xs text-slate-500">
          See <code className="rounded bg-slate-100 px-1">DEPLOY.md</code> in the repo
          for a full walkthrough.
        </p>
      </div>
    </div>
  );
}
