import "dotenv/config";

async function main() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = process.env.CRON_SECRET;
  if (!token) throw new Error("CRON_SECRET missing");

  const res = await fetch(`${base}/api/cron/reports`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  console.log(res.status, await res.text());
}

main().catch((e) => { console.error(e); process.exit(1); });
