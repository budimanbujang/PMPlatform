"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export async function addMemberByEmail(input: {
  projectId: string;
  organisationId: string;
  email: string;
  role: string;
}) {
  await requireProfile();
  const rows = await sql`
    SELECT id FROM profiles WHERE lower(email) = ${input.email.trim().toLowerCase()} LIMIT 1
  `;
  const profile = rows[0] as any;
  if (!profile) {
    throw new Error("No matching user — ask them to sign in once first.");
  }
  await sql`
    INSERT INTO members (organisation_id, project_id, profile_id, role)
    VALUES (
      ${input.organisationId},
      ${input.projectId},
      ${profile.id},
      ${input.role}::member_role
    )
    ON CONFLICT DO NOTHING
  `;
  revalidatePath(`/projects/${input.projectId}/members`);
}

export async function removeMember(memberId: string, projectId: string) {
  await requireProfile();
  await sql`DELETE FROM members WHERE id = ${memberId}`;
  revalidatePath(`/projects/${projectId}/members`);
}
