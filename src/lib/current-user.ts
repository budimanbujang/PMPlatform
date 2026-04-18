// =============================================================================
// Server-side helpers to get the current user. Replaces Supabase equivalents.
// requireProfile() redirects to /login or /onboarding when needed.
//
// During the Azure migration we return the OLD snake_case Profile shape
// (from src/types/database.ts) so existing components don't break. Stage 4
// flips call sites to the Drizzle-inferred camelCase types.
// =============================================================================

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles as profilesTable } from "@/lib/db/schema";
import type { Profile } from "@/types/database";

export async function currentSession() {
  return auth();
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireProfile(): Promise<Profile> {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user || !email) redirect("/login");

  const rows = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, email.toLowerCase()))
    .limit(1);

  const p = rows[0];
  if (!p) redirect("/onboarding");
  if (!p.organisationId) redirect("/onboarding");

  // Map Drizzle → old snake_case shape that the rest of the codebase uses.
  // Stage 4 will remove this shim when call sites are migrated.
  return {
    id:                p.id,
    organisation_id:   p.organisationId,
    email:             p.email,
    full_name:         p.fullName,
    avatar_url:        p.avatarUrl,
    job_title:         p.jobTitle,
    department:        p.department,
    is_platform_admin: p.isPlatformAdmin,
    created_at:        p.createdAt.toISOString(),
    updated_at:        p.updatedAt.toISOString(),
  };
}
