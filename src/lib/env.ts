import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("pmo@jcorp.my"),
  RESEND_FROM_NAME: z.string().default("JCorp PMO Platform"),
  TEAMS_WEBHOOK_URL: z.string().url().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("JCorp PMO"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid env vars: ${missing}. Copy .env.example to .env.local.`);
  }
  cached = parsed.data;
  return cached;
}

// Safe accessor for pages that can render without secrets (public UI).
export function publicEnv() {
  return {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "JCorp PMO",
  };
}
