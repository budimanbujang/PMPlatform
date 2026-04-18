// =============================================================================
// Azure Blob Storage utility. Replaces Supabase Storage.
//
// Two containers: `project-documents` for user uploads, `reports` for
// generated PDFs. Names come from env vars so they can be overridden.
//
// All reads go through short-lived SAS URLs (10 minutes for docs, 7 days for
// emailed report links). Uploads happen server-side via server actions —
// the browser never holds the account key.
// =============================================================================

import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  type ContainerClient,
} from "@azure/storage-blob";

type ContainerName = "docs" | "reports";

function credentials(): { account: string; key: string } {
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const key = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  if (!account || !key) {
    throw new Error("AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY must be set");
  }
  return { account, key };
}

let cachedService: BlobServiceClient | null = null;
let cachedCred: StorageSharedKeyCredential | null = null;

function service(): { client: BlobServiceClient; cred: StorageSharedKeyCredential } {
  if (cachedService && cachedCred) return { client: cachedService, cred: cachedCred };
  const { account, key } = credentials();
  cachedCred = new StorageSharedKeyCredential(account, key);
  cachedService = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    cachedCred,
  );
  return { client: cachedService, cred: cachedCred };
}

function containerName(which: ContainerName): string {
  return which === "docs"
    ? process.env.AZURE_STORAGE_DOCS_CONTAINER ?? "project-documents"
    : process.env.AZURE_STORAGE_REPORTS_CONTAINER ?? "reports";
}

function getContainer(which: ContainerName): ContainerClient {
  const { client } = service();
  return client.getContainerClient(containerName(which));
}

// -----------------------------------------------------------------------------
// Uploads
// -----------------------------------------------------------------------------

export interface UploadInput {
  which:      ContainerName;
  path:       string;   // blob name — e.g. `${org}/${project}/${submission}/${filename}`
  data:       Buffer | Uint8Array;
  contentType?: string;
  overwrite?: boolean;  // defaults to true
}

export async function uploadBlob(input: UploadInput): Promise<{ path: string }> {
  const container = getContainer(input.which);
  const blob = container.getBlockBlobClient(input.path);
  const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data);
  await blob.uploadData(data, {
    blobHTTPHeaders: input.contentType ? { blobContentType: input.contentType } : undefined,
  });
  return { path: input.path };
}

// -----------------------------------------------------------------------------
// SAS signed URLs
// -----------------------------------------------------------------------------

export function signedReadUrl(
  which: ContainerName,
  blobPath: string,
  opts: { expiresInSeconds?: number } = {},
): string {
  const { cred } = service();
  const container = containerName(which);
  const expiresOn = new Date(Date.now() + 1000 * (opts.expiresInSeconds ?? 600));

  const sas = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
      protocol: "https" as any,
    },
    cred,
  ).toString();

  const account = cred.accountName;
  return `https://${account}.blob.core.windows.net/${container}/${encodeURI(blobPath)}?${sas}`;
}

// -----------------------------------------------------------------------------
// Delete (used when a submission is voided or a report re-generated)
// -----------------------------------------------------------------------------
export async function deleteBlob(which: ContainerName, blobPath: string): Promise<void> {
  const container = getContainer(which);
  await container.deleteBlob(blobPath, { deleteSnapshots: "include" }).catch((e) => {
    // 404 — blob already gone; fine.
    if (e?.statusCode === 404) return;
    throw e;
  });
}

// -----------------------------------------------------------------------------
// Blob existence + metadata (rarely needed; used in report generation retry)
// -----------------------------------------------------------------------------
export async function blobExists(which: ContainerName, blobPath: string): Promise<boolean> {
  const container = getContainer(which);
  return container.getBlobClient(blobPath).exists();
}
