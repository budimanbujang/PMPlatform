import { Resend } from "resend";
import { env } from "@/lib/env";

let client: Resend | null = null;

export function resend() {
  if (client) return client;
  const key = env().RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  client = new Resend(key);
  return client;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | Uint8Array }>;
}) {
  const e = env();
  const from = `${e.RESEND_FROM_NAME} <${e.RESEND_FROM_EMAIL}>`;
  const { data, error } = await resend().emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
    })),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function postTeamsWebhook(title: string, body: string) {
  const url = env().TEAMS_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      "@type": "MessageCard", "@context": "https://schema.org/extensions",
      summary: title, title, text: body,
    }),
  });
}
