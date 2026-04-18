// NextAuth.js catch-all endpoint — handles /api/auth/signin,
// /api/auth/callback/azure-ad, /api/auth/session, /api/auth/signout, etc.
// Owned entirely by NextAuth; our code never reaches into it.

import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;

// Force Node runtime so DB calls in the NextAuth callbacks work.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
