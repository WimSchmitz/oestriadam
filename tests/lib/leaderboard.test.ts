import { describe, it, expect } from "vitest";
import { buildLeaderboard } from "@/lib/leaderboard";
import type { Participant, Split, Race } from "@/lib/types";

const race: Race = { id: "r", eventName: "Oestriadam", gunTime: "2026-06-20T10:00:00.000Z" };

const p = (id: string, bib: number, over: Partial<Participant> = {}): Participant => ({
  id, bib, name: `A${bib}`, type: "individual", teamName: null,
  category: "M", gender: "M", athleteNames: null,
  status: "active", ...over,
});

const split = (pid: string, point: Split["point"], at: string): Split => ({
  id: `${pid}-${point}`, participantId: pid, point, recordedAt: at, stationKeyUsed: "k", voided: false,
});

describe("buildLeaderboard", () => {
  it("ranks finishers by total time ascending, then in-progress by furthest checkpoint", () => {
    const participants = [p("a", 1), p("b", 2), p("c", 3)];
    const splits = [
      // a finishes in 2h20
      split("a", "t1", "2026-06-20T10:20:00.000Z"),
      split("a", "t2", "2026-06-20T11:40:00.000Z"),
      split("a", "finish", "2026-06-20T12:20:00.000Z"),
      // b finishes faster: 2h00
      split("b", "t1", "2026-06-20T10:18:00.000Z"),
      split("b", "t2", "2026-06-20T11:20:00.000Z"),
      split("b", "finish", "2026-06-20T12:00:00.000Z"),
      // c still cycling (reached t1 only)
      split("c", "t1", "2026-06-20T10:19:00.000Z"),
    ];
    const lb = buildLeaderboard(race, participants, splits);
    expect(lb.map((e) => e.participant.bib)).toEqual([2, 1, 3]);
    expect(lb.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("breaks in-progress ties by earliest checkpoint time", () => {
    const participants = [p("a", 1), p("b", 2)];
    const splits = [
      split("a", "t1", "2026-06-20T10:25:00.000Z"),
      split("b", "t1", "2026-06-20T10:20:00.000Z"), // earlier => ahead
    ];
    const lb = buildLeaderboard(race, participants, splits);
    expect(lb.map((e) => e.participant.bib)).toEqual([2, 1]);
  });

  it("excludes dnf/dns/not-started from ranking (rank null, sorted last)", () => {
    const participants = [
      p("a", 1),
      p("b", 2, { status: "dnf" }),
      p("c", 3), // active but no splits => not_started-ish (swimming, furthest 0)
    ];
    const splits = [
      split("a", "t1", "2026-06-20T10:20:00.000Z"),
      split("a", "t2", "2026-06-20T11:40:00.000Z"),
      split("a", "finish", "2026-06-20T12:20:00.000Z"),
    ];
    const lb = buildLeaderboard(race, participants, splits);
    expect(lb[0].participant.bib).toBe(1);
    expect(lb[0].rank).toBe(1);
    const dnf = lb.find((e) => e.participant.bib === 2)!;
    expect(dnf.rank).toBeNull();
  });

  it("ranks individuals within their gender and teams as their own group", () => {
    const participants = [
      p("a", 1, { gender: "M" }),
      p("b", 2, { gender: "V" }),
      p("c", 3, { gender: "M" }),
      p("d", 4, { type: "relay", gender: null, teamName: "Team Speed" }),
      p("e", 5, { type: "relay", gender: null, teamName: "De Krabben" }),
    ];
    const fin = (pid: string, t: string) => [
      split(pid, "t1", "2026-06-20T10:20:00.000Z"),
      split(pid, "t2", "2026-06-20T11:40:00.000Z"),
      split(pid, "finish", t),
    ];
    const splits = [
      ...fin("a", "2026-06-20T12:30:00.000Z"),
      ...fin("b", "2026-06-20T12:10:00.000Z"),
      ...fin("c", "2026-06-20T12:20:00.000Z"),
      ...fin("d", "2026-06-20T12:40:00.000Z"),
      ...fin("e", "2026-06-20T12:15:00.000Z"),
    ];
    const lb = buildLeaderboard(race, participants, splits);
    const byBib = Object.fromEntries(lb.map((e) => [e.participant.bib, e]));
    expect(byBib[3].categoryRank).toBe(1); // fastest M
    expect(byBib[1].categoryRank).toBe(2); // slower M
    expect(byBib[2].categoryRank).toBe(1); // only V
    expect(byBib[5].categoryRank).toBe(1); // fastest team
    expect(byBib[4].categoryRank).toBe(2); // slower team
  });
});
