import { PageHeader } from "@/components/ui/page-header";
import { supabaseServer } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/current-user";
import { redirect } from "next/navigation";
import { OrgSettings } from "./form";

export default async function OrgAdminPage() {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) redirect("/");
  const sb = supabaseServer();
  const { data: org } = await sb.from("organisations").select("*").eq("id", profile.organisation_id ?? "").single();
  if (!org) redirect("/");
  return (
    <>
      <PageHeader title="Organisation settings" description="Branding, region and top-level configuration." />
      <OrgSettings org={org as any} />
    </>
  );
}
