import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import { getRace, setGunTime } from "@/server/data";

export const dynamic = "force-dynamic";

function adminAuthed(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") ?? new URL(req.url).searchParams.get("key");
  return keyIsValid(process.env.ADMIN_KEY, key);
}

export async function GET() {
  return NextResponse.json({ race: await getRace() });
}

// POST { action: "start" } sets gun_time=now; { action: "clear" } resets it.
export async function POST(req: NextRequest) {
  if (!adminAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.action === "start") {
    await setGunTime(new Date().toISOString());
  } else if (body.action === "clear") {
    await setGunTime(null);
  } else {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }
  return NextResponse.json({ race: await getRace() });
}
