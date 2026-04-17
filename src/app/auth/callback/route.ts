import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const res = NextResponse.redirect(new URL(next, url.origin));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (n) => req.cookies.get(n)?.value,
          set: (n, v, o) => res.cookies.set({ name: n, value: v, ...o }),
          remove: (n, o) => res.cookies.set({ name: n, value: "", ...o }),
        },
      },
    );
    await supabase.auth.exchangeCodeForSession(code);
    return res;
  }

  return NextResponse.redirect(new URL("/login", url.origin));
}
