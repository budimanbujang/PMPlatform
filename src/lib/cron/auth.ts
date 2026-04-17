import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export function requireCronAuth(req: NextRequest): NextResponse | null {
  const expected = env().CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.nextUrl.searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
