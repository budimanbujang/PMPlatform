// =============================================================================
// NextAuth.js v5 configuration — Microsoft Entra ID federated sign-in.
// Replaces Supabase Auth. Uses JWT session strategy (no DB adapter needed)
// and upserts a `profiles` row on first sign-in so the rest of the app
// can continue to reference profile.id / organisation_id / is_platform_admin.
//
// Exports:
//   handlers  → used by /api/auth/[...nextauth]/route.ts
//   auth      → async helper to read the session (server / route / middleware)
//   signIn    → server-action helper to start an Entra flow
//   signOut   → server-action helper to end the session
// =============================================================================

import NextAuth, { type NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, organisations } from "@/lib/db/schema";

const TENANT = process.env.AZURE_AD_TENANT_ID!;

const config: NextAuthConfig = {
  // The session cookie is signed with this secret. Required in production.
  secret: process.env.NEXTAUTH_SECRET,

  // `trustHost` lets Auth.js honour X-Forwarded-Host/Proto from App Service's
  // reverse proxy. Without this, callback URLs rewrite to localhost:8080.
  trustHost: true,

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    MicrosoftEntraID({
      // `id` override keeps the redirect URI at /api/auth/callback/azure-ad
      // so we don't have to re-register the Entra app with a new URI.
      id: "azure-ad",
      clientId:     process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer:       `https://login.microsoftonline.com/${TENANT}/v2.0`,
      // Request the scopes we actually use. `offline_access` lets Auth.js
      // refresh the session without redirecting the user again.
      authorization: { params: { scope: "openid email profile offline_access User.Read" } },
    }),
  ],

  callbacks: {
    // Runs on every sign-in. We upsert the profile row here; if this returns
    // false the flow aborts and the user sees an error page.
    async signIn({ user, account }) {
      if (account?.provider !== "azure-ad") return false;
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const entraOid = account.providerAccountId;  // Entra object id
      const fullName = user.name ?? null;
      const avatarUrl = user.image ?? null;

      // Find the organisation whose domain matches the user's email.
      const domain = email.split("@")[1]?.toLowerCase() ?? "";
      const matchingOrg = domain
        ? await db.select({ id: organisations.id })
            .from(organisations)
            .where(eq(organisations.domain, domain))
            .limit(1)
        : [];
      const orgId = matchingOrg[0]?.id ?? null;

      // Upsert on email — profile rows survive across sign-ins even if the
      // Entra oid changes (it shouldn't, but belt + braces).
      await db
        .insert(profiles)
        .values({
          email,
          fullName,
          avatarUrl,
          entraOid,
          organisationId: orgId,
        })
        .onConflictDoUpdate({
          target: profiles.email,
          set: {
            entraOid,
            fullName,
            avatarUrl,
            organisationId: orgId ?? undefined,
            updatedAt: new Date(),
          },
        });

      return true;
    },

    // Stuff the profile into the JWT so session() can return it cheaply.
    async jwt({ token, user, account }) {
      // On initial sign-in, `user` is populated. On subsequent requests only
      // `token` is present — but the data we stash here stays.
      if (user?.email || account?.providerAccountId) {
        const email = (user?.email ?? token.email ?? "").toString().toLowerCase();
        if (email) {
          const rows = await db
            .select({
              id:               profiles.id,
              email:            profiles.email,
              fullName:         profiles.fullName,
              avatarUrl:        profiles.avatarUrl,
              organisationId:   profiles.organisationId,
              isPlatformAdmin:  profiles.isPlatformAdmin,
              jobTitle:         profiles.jobTitle,
            })
            .from(profiles)
            .where(eq(profiles.email, email))
            .limit(1);

          const p = rows[0];
          if (p) {
            token.profileId       = p.id;
            token.email           = p.email;
            token.name            = p.fullName ?? token.name;
            token.picture         = p.avatarUrl ?? token.picture;
            token.organisationId  = p.organisationId;
            token.isPlatformAdmin = p.isPlatformAdmin;
            token.jobTitle        = p.jobTitle;
          }
        }
      }
      return token;
    },

    // Expose the useful bits on session.user.
    async session({ session, token }) {
      (session.user as any).profileId       = token.profileId;
      (session.user as any).organisationId  = token.organisationId ?? null;
      (session.user as any).isPlatformAdmin = !!token.isPlatformAdmin;
      (session.user as any).jobTitle        = token.jobTitle ?? null;
      return session;
    },

    // Central auth check called by middleware via the auth() wrapper.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/cron") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/setup") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico";
      if (isPublic) return true;
      return !!auth;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
