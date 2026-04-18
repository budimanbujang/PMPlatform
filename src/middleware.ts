// Middleware — NextAuth v5 style. `auth` exported from src/lib/auth.ts is
// a higher-order function that wraps the request handler and injects the
// session. The `authorized` callback in lib/auth.ts decides whether the
// request may proceed; we only need to handle the redirect when it can't.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/setup") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();
  if (isAuthed) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
