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
    // Runs on every sign-in. Upserts the profile row. Returning false here
    // aborts the flow and the user sees /login?error=AccessDenied.
    async signIn({ user, account, profile }) {
      try {
        // Microsoft ID tokens can put the address in any of these fields
        // depending on tenant config. Take whichever is present.
        const rawEmail =
          user?.email ??
          (profile as any)?.email ??
          (profile as any)?.preferred_username ??
          (profile as any)?.upn ??
          "";
        const email = String(rawEmail).toLowerCase().trim();
        if (!email) {
          console.error("[auth.signIn] no email on token", {
            provider: account?.provider,
            profileKeys: profile ? Object.keys(profile) : [],
          });
          return false;
        }

        const entraOid = account?.providerAccountId ?? (profile as any)?.oid ?? null;
        const fullName =
          user?.name ??
          (profile as any)?.name ??
          ((profile as any)?.given_name && (profile as any)?.family_name
            ? `${(profile as any).given_name} ${(profile as any).family_name}`
            : null);
        const avatarUrl = user?.image ?? null;

        // Match organisation by email domain.
        const domain = email.split("@")[1]?.toLowerCase() ?? "";
        const matchingOrg = domain
          ? await db
              .select({ id: organisations.id })
              .from(organisations)
              .where(eq(organisations.domain, domain))
              .limit(1)
          : [];
        const orgId = matchingOrg[0]?.id ?? null;

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
      } catch (e) {
        console.error("[auth.signIn] failed", e);
        // Don't silently deny access on a DB hiccup — surface it in the logs,
        // but still block the login so we don't leak a broken session.
        return false;
      }
    },

    // Stuff the profile into the JWT so session() can return it cheaply.
    async jwt({ token, user, account, profile: idTokenProfile }) {
      // Capture Entra group memberships from the id_token claims, if the
      // Entra app registration is configured to emit them. Falls back to
      // an empty array so portfolio RBAC code can always assume an array.
      // Configure in Entra: App registration → Token configuration →
      //   Add groups claim → Security groups → ID token.
      if (idTokenProfile && Array.isArray((idTokenProfile as any).groups)) {
        token.entraGroups = (idTokenProfile as any).groups as string[];
      }

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
      (session.user as any).entraGroups     = (token.entraGroups as string[] | undefined) ?? [];
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
