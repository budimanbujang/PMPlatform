"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireProfile } from "@/lib/current-user";

export async function acknowledgeInsight(insightId: string) {
  const profile = await requireProfile();
  await sql`
    UPDATE ai_insights
    SET acknowledged_at = now(), acknowledged_by = ${profile.id}
    WHERE id = ${insightId}
  `;
  revalidatePath("/insights");
}
