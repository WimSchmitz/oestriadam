import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import {
  getParticipantByBibAndType,
  getParticipants,
  getSplitsForParticipant,
  recordSplit,
  voidSplit,
  getSplits,
} from "@/server/data";
import { POINTS, type Point, type ParticipantType } from "@/lib/types";
import { splitWarnings, type SplitWarning } from "@/lib/warnings";

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
  const type = body.type as ParticipantType;
  if (type !== "individual" && type !== "relay") {
    return NextResponse.json({ error: "bad type" }, { status: 400 });
  }

  const participant = await getParticipantByBibAndType(bib, type);
  if (!participant) {
    // Unknown bib: report it so the station UI can warn and the admin reconciles.
    return NextResponse.json({ error: "unknown_bib", bib }, { status: 404 });
  }

  // "Needs-check" flags, computed before the re-record void supersedes the prior split.
  const existing = (await getSplitsForParticipant(participant.id)).filter((s) => !s.voided);
  const isRerecord = existing.some((s) => s.point === point);
  const otherPoints = existing.filter((s) => s.point !== point).map((s) => s.point);
  const warnings = splitWarnings({ point, otherPoints, isRerecord });

  const split = await recordSplit(participant.id, point, process.env.STATION_KEY ?? "");
  return NextResponse.json({ ok: true, split, participant, warnings });
}

// GET recent splits for a point (?point=t1) for the station "recent" list,
// enriched with the participant's bib + display name.
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const point = new URL(req.url).searchParams.get("point");
  const [all, participants] = await Promise.all([getSplits(), getParticipants()]);
  const byId = new Map(participants.map((p) => [p.id, p]));

  // Group every split (incl. voided) per participant, so we can reconstruct the
  // same "needs-check" flags for the recent list that the operator saw on record.
  const byParticipant = new Map<string, typeof all>();
  for (const s of all) {
    const arr = byParticipant.get(s.participantId) ?? [];
    arr.push(s);
    byParticipant.set(s.participantId, arr);
  }

  function warningsFor(split: (typeof all)[number]): SplitWarning[] {
    const mine = byParticipant.get(split.participantId) ?? [];
    const otherPoints = mine
      .filter((s) => !s.voided && s.id !== split.id)
      .map((s) => s.point);
    // Re-record: an earlier split (now voided) existed at this same checkpoint.
    const isRerecord = mine.some(
      (s) => s.point === split.point && s.id !== split.id && s.recordedAt < split.recordedAt,
    );
    return splitWarnings({ point: split.point, otherPoints, isRerecord });
  }

  const recent = all
    .filter((s) => !s.voided && (!point || s.point === point))
    .slice(-15)
    .reverse()
    .map((s) => {
      const p = byId.get(s.participantId);
      return {
        ...s,
        bib: p?.bib ?? null,
        name: p ? (p.type === "relay" ? p.teamName ?? p.name : p.name) : null,
        warnings: warningsFor(s),
      };
    });
  return NextResponse.json({ splits: recent });
}
