"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export async function updateOrganisation(input: {
  id: string;
  name: string;
  slug: string;
  domain: string;
  brand_primary: string;
  region: string;
}) {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) throw new Error("Not authorised");
  await sql`
    UPDATE organisations
    SET name = ${input.name},
        slug = ${input.slug},
        domain = ${input.domain || null},
        brand_primary = ${input.brand_primary},
        region = ${input.region}
    WHERE id = ${input.id}
  `;
  revalidatePath("/admin/organisation");
}
