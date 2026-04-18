import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!session?.user || !email) redirect("/login");

  const orgs = await sql`SELECT id FROM organisations LIMIT 2`;
  if (orgs.length === 1) {
    await db.update(profiles)
      .set({ organisationId: orgs[0].id as string })
      .where(eq(profiles.email, email));
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-bg-subtle">
      <div className="card max-w-md">
        <div className="card-body space-y-4 text-center">
          <h1 className="display-h2">Welcome to JCorp PMPlatform</h1>
          <p className="text-sm text-fg3">
            Your account is not yet attached to an organisation. Contact your PMO administrator to be
            added before you can see projects.
          </p>
          <p className="text-xs text-fg4">Signed in as {email}</p>
        </div>
      </div>
    </div>
  );
}
