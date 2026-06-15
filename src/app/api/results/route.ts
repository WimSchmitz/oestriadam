import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import { getRace, getParticipants, getSplits } from "@/server/data";
import { buildLeaderboard } from "@/lib/leaderboard";
import { toResultsCsv } from "@/lib/results-csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key") ?? new URL(req.url).searchParams.get("key");
  if (!keyIsValid(process.env.ADMIN_KEY, key)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [race, participants, splits] = await Promise.all([
    getRace(),
    getParticipants(),
    getSplits(),
  ]);
  const csv = toResultsCsv(buildLeaderboard(race, participants, splits));
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": 'attachment; filename="oestriadam-results.csv"',
    },
  });
}
