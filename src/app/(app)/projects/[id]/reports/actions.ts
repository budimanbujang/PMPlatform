"use server";

import { requireProfile } from "@/lib/current-user";
import { signedReadUrl } from "@/lib/storage/azure-blob";

export async function getReportDownloadUrl(pdfPath: string): Promise<string> {
  await requireProfile();
  // 10-minute SAS — just long enough for the user to click through.
  return signedReadUrl("reports", pdfPath, { expiresInSeconds: 600 });
}
