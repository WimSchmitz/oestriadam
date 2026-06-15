import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import { getParticipantByBib, recordSplit, voidSplit, getSplits } from "@/server/data";
import { POINTS, type Point } from "@/lib/types";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const key = req.headers.get("x-station-key") ?? new URL(req.url).searchParams.get("key");
  return keyIsValid(process.env.STATION_KEY, key);
}

// POST { action: "record", bib, point } | { action: "undo", splitId }
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();

  if (body.action === "undo") {
    if (!body.splitId) return NextResponse.json({ error: "splitId required" }, { status: 400 });
    await voidSplit(body.splitId);
    return NextResponse.json({ ok: true });
  }

  const point = body.point as Point;
  if (!POINTS.includes(point)) return NextResponse.json({ error: "bad point" }, { status: 400 });
  const bib = Number(body.bib);
  if (!Number.isInteger(bib)) return NextResponse.json({ error: "bad bib" }, { status: 400 });

  const participant = await getParticipantByBib(bib);
  if (!participant) {
    // Unknown bib: report it so the station UI can warn and the admin reconciles.
    return NextResponse.json({ error: "unknown_bib", bib }, { status: 404 });
  }
  const split = await recordSplit(participant.id, point, process.env.STATION_KEY ?? "");
  return NextResponse.json({ ok: true, split, participant });
}

// GET recent splits for a point (?point=t1) for the station "recent" list.
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const point = new URL(req.url).searchParams.get("point");
  const all = await getSplits();
  const filtered = all.filter((s) => !s.voided && (!point || s.point === point));
  return NextResponse.json({ splits: filtered.slice(-15).reverse() });
}
