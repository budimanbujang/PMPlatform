// =============================================================================
// Portfolio RBAC — decides whether a user can see a portfolio.
//
// Rules:
//   1. Platform admins see everything.
//   2. access_mode='public'      → anyone in the same org sees it.
//   3. access_mode='restricted'  → user must be in at least one of the
//      portfolio's allowed_entra_groups (object IDs from Entra). Groups
//      come from the ID token at sign-in (see auth.ts jwt callback) and
//      ride along on session.user.entraGroups.
//
// All filtering is done server-side. Never rely on the client to honour these.
// =============================================================================

import { auth } from "@/lib/auth";

export interface AuthContext {
  profileId: string;
  organisationId: string | null;
  isPlatformAdmin: boolean;
  entraGroups: string[];
}

/** Pull the auth context for the current request. Cached per call. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  const u: any = session?.user;
  if (!u) return null;
  return {
    profileId:        u.profileId ?? "",
    organisationId:   u.organisationId ?? null,
    isPlatformAdmin:  !!u.isPlatformAdmin,
    entraGroups:      Array.isArray(u.entraGroups) ? u.entraGroups : [],
  };
}

/** True if the current user can see the given portfolio. */
export function canViewPortfolio(
  ctx: AuthContext,
  portfolio: {
    organisation_id: string;
    access_mode: string;
    allowed_entra_groups: string[];
  },
): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (portfolio.organisation_id !== ctx.organisationId) return false;
  if (portfolio.access_mode === "public") return true;
  // Restricted: any overlap with the user's Entra groups grants access.
  return portfolio.allowed_entra_groups.some((g) => ctx.entraGroups.includes(g));
}
