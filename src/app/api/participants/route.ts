import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import {
  getParticipants, upsertParticipants, setParticipantStatus, deleteParticipant,
} from "@/server/data";
import { parseParticipantsCsv } from "@/lib/csv";
import type { ParticipantStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function adminAuthed(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") ?? new URL(req.url).searchParams.get("key");
  return keyIsValid(process.env.ADMIN_KEY, key);
}

export async function GET() {
  return NextResponse.json({ participants: await getParticipants() });
}

// POST handles: { action: "import", csv } | { action: "add", row } |
//   { action: "status", id, status } | { action: "delete", id }
export async function POST(req: NextRequest) {
  if (!adminAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();

  if (body.action === "import") {
    const { rows, errors } = parseParticipantsCsv(String(body.csv ?? ""));
    if (errors.length) return NextResponse.json({ error: "validation", errors }, { status: 400 });
    await upsertParticipants(rows);
    return NextResponse.json({ ok: true, imported: rows.length });
  }
  if (body.action === "add") {
    const { rows, errors } = parseParticipantsCsv(
      "bib,name,type,team_name,category,relay_swimmer,relay_cyclist,relay_runner\n" +
        [body.row.bib, body.row.name, body.row.type, body.row.teamName ?? "",
         body.row.category ?? "", body.row.relaySwimmer ?? "",
         body.row.relayCyclist ?? "", body.row.relayRunner ?? ""].join(","),
    );
    if (errors.length) return NextResponse.json({ error: "validation", errors }, { status: 400 });
    await upsertParticipants(rows);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "status") {
    await setParticipantStatus(body.id, body.status as ParticipantStatus);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete") {
    await deleteParticipant(body.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad action" }, { status: 400 });
}
