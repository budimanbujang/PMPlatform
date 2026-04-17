import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let client: Anthropic | null = null;

export function anthropic() {
  if (client) return client;
  const key = env().ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  client = new Anthropic({ apiKey: key });
  return client;
}

export interface ClaudeCall<T = unknown> {
  system: string;
  user: string;
  cacheableSystem?: boolean;
  maxTokens?: number;
  temperature?: number;
  modelOverride?: string;
}

export interface ClaudeResult {
  text: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  model: string;
}

export async function callClaude(opts: ClaudeCall): Promise<ClaudeResult> {
  const model = opts.modelOverride ?? env().ANTHROPIC_MODEL;
  const t0 = Date.now();

  const response = await anthropic().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 2500,
    temperature: opts.temperature ?? 0.2,
    system: opts.cacheableSystem
      ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
      : opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n");

  return {
    text,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    latency_ms: Date.now() - t0,
    model,
  };
}

/** Retry with exponential backoff for 429/5xx. */
export async function callClaudeWithRetry(opts: ClaudeCall, tries = 4): Promise<ClaudeResult> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await callClaude(opts);
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.response?.status;
      const retriable = status === 429 || (status >= 500 && status < 600);
      if (!retriable || attempt === tries) break;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  throw lastErr;
}
