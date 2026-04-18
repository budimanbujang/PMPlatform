import { PageHeader } from "@/components/ui/page-header";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";
import { redirect } from "next/navigation";
import { OrgSettings } from "./form";

export const dynamic = "force-dynamic";

export default async function OrgAdminPage() {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) redirect("/");
  const rows = await sql`SELECT * FROM organisations WHERE id = ${profile.organisation_id ?? ""} LIMIT 1`;
  const org = rows[0] as any;
  if (!org) redirect("/");
  return (
    <>
      <PageHeader title="Organisation settings" description="Branding, region and top-level configuration." />
      <OrgSettings org={org} />
    </>
  );
}
