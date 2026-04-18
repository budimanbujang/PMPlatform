import { z } from "zod";

// Accept URLs with or without a scheme; prepend https:// when missing.
// Tolerates a common Azure App Service gotcha where values get pasted as
// `myapp.azurewebsites.net` instead of `https://myapp.azurewebsites.net`.
const tolerantUrl = z
  .string()
  .min(1)
  .transform((v) => (v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`));

const schema = z.object({
  // --- Azure Postgres ---
  DATABASE_URL: z.string().min(20),

  // --- NextAuth / Entra ID ---
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  NEXTAUTH_URL: tolerantUrl.optional(),
  AZURE_AD_TENANT_ID: z.string().min(20).optional(),
  AZURE_AD_CLIENT_ID:  z.string().min(20).optional(),
  AZURE_AD_CLIENT_SECRET: z.string().min(1).optional(),

  // --- Azure Blob Storage ---
  AZURE_STORAGE_ACCOUNT_NAME: z.string().optional(),
  AZURE_STORAGE_ACCOUNT_KEY:  z.string().optional(),
  AZURE_STORAGE_DOCS_CONTAINER:    z.string().default("project-documents"),
  AZURE_STORAGE_REPORTS_CONTAINER: z.string().default("reports"),

  // --- Anthropic ---
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),

  // --- Resend ---
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("pmo@jcorp.com.my"),
  RESEND_FROM_NAME: z.string().default("JCorp PMPlatform"),

  // --- Misc ---
  TEAMS_WEBHOOK_URL: z.string().url().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_APP_URL: tolerantUrl.default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("JCorp PMPlatform"),

  // --- Legacy Supabase (removed in stage 6; kept optional during the
  //     migration so the app can run against either stack) ---
  NEXT_PUBLIC_SUPABASE_URL: tolerantUrl.optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid env vars — ${detail}`);
  }
  cached = parsed.data;
  return cached;
}

function normaliseUrl(v: string | undefined, fallback: string): string {
  if (!v) return fallback;
  return v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`;
}

export function publicEnv() {
  return {
    SUPABASE_URL: normaliseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, ""),
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    APP_URL: normaliseUrl(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"),
    APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "JCorp PMPlatform",
  };
}
