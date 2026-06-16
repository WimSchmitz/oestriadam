import { describe, it, expect } from "vitest";
import { parseParticipantsCsv } from "@/lib/csv";
import { buildLeaderboard } from "@/lib/leaderboard";
import type { Participant, Race, Split } from "@/lib/types";

describe("record flow (CSV -> leaderboard)", () => {
  it("imports a roster and ranks a finisher ahead of an in-progress athlete", () => {
    const csv = [
      "bib,name,type,gender,athlete_names,category",
      "1,Jan,individual,M,,M",
      "2,Piet,individual,M,,M",
    ].join("\n");
    const { rows, errors } = parseParticipantsCsv(csv);
    expect(errors).toEqual([]);

    const participants: Participant[] = rows.map((r, i) => ({
      id: `p${i}`, bib: r.bib, name: r.name, type: r.type, teamName: r.teamName,
      category: r.category, gender: r.gender, athleteNames: r.athleteNames, status: "active",
    }));
    const byBib = Object.fromEntries(participants.map((p) => [p.bib, p.id]));

    const race: Race = { id: "r", eventName: "Oestriadam", gunTime: "2026-06-20T10:00:00.000Z" };
    const mk = (pid: string, point: Split["point"], at: string): Split => ({
      id: `${pid}-${point}`, participantId: pid, point, recordedAt: at, stationKeyUsed: "k", voided: false,
    });
    const splits: Split[] = [
      mk(byBib[1], "t1", "2026-06-20T10:20:00.000Z"),
      mk(byBib[1], "t2", "2026-06-20T11:40:00.000Z"),
      mk(byBib[1], "finish", "2026-06-20T12:20:00.000Z"),
      mk(byBib[2], "t1", "2026-06-20T10:21:00.000Z"), // still cycling
    ];

    const lb = buildLeaderboard(race, participants, splits);
    expect(lb[0].participant.bib).toBe(1);
    expect(lb[0].rank).toBe(1);
    expect(lb[0].progress.state).toBe("finished");
    expect(lb[1].participant.bib).toBe(2);
    expect(lb[1].progress.state).toBe("cycling");
  });
});
