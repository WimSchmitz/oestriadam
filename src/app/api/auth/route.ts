import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Lightweight check so the station/admin screens can validate a key before use.
// GET /api/auth?scope=admin|station&key=...  -> 200 { ok: true } or 401 { ok: false }
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const key = url.searchParams.get("key") ?? req.headers.get("x-key");

  if (scope !== "admin" && scope !== "station") {
    return NextResponse.json({ error: "bad scope" }, { status: 400 });
  }
  const expected = scope === "admin" ? process.env.ADMIN_KEY : process.env.STATION_KEY;
  return keyIsValid(expected, key)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false }, { status: 401 });
}
