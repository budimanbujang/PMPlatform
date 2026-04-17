import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Returns the external origin the user's browser sees, not the internal
// container URL. On Azure App Service / Vercel / any reverse proxy,
// req.url reports http://localhost:8080 (the internal port) rather than
// the public hostname. We reconstruct the real origin from forwarded
// headers, falling back to NEXT_PUBLIC_APP_URL, then to req.url.
function externalOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    // Tolerate missing scheme in the env var.
    return envUrl.startsWith("http") ? envUrl.replace(/\/$/, "") : `https://${envUrl.replace(/\/$/, "")}`;
  }

  const fwdHost  = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto") ?? "https";
  if (fwdHost) return `${fwdProto}://${fwdHost}`;

  return new URL(req.url).origin;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const origin = externalOrigin(req);

  if (code) {
    const res = NextResponse.redirect(new URL(next, origin));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (n: string) => req.cookies.get(n)?.value,
          set: (n: string, v: string, o: CookieOptions) =>
            res.cookies.set({ name: n, value: v, ...o }),
          remove: (n: string, o: CookieOptions) =>
            res.cookies.set({ name: n, value: "", ...o }),
        },
      },
    );
    await supabase.auth.exchangeCodeForSession(code);
    return res;
  }

  return NextResponse.redirect(new URL("/login", origin));
}
