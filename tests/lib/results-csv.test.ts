import { describe, it, expect } from "vitest";
import { toResultsCsv } from "@/lib/results-csv";
import type { LeaderboardEntry, Participant, Progress } from "@/lib/types";

const prog: Progress = {
  state: "finished", swimMs: 1_200_000, bikeMs: 4_800_000, runMs: 2_400_000,
  totalMs: 8_400_000, furthest: 3, furthestAt: "2026-06-20T12:20:00.000Z",
};
const participant: Participant = {
  id: "p", bib: 1, name: "Jan", type: "individual", teamName: null, category: "M",
  relaySwimmer: null, relayCyclist: null, relayRunner: null, status: "active",
};

describe("toResultsCsv", () => {
  it("emits a header and one row per entry with formatted splits", () => {
    const entries: LeaderboardEntry[] = [{ participant, progress: prog, rank: 1, categoryRank: 1 }];
    const csv = toResultsCsv(entries);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("rank,bib,name,category,category_rank,status,swim,bike,run,total");
    expect(lines[1]).toBe("1,1,Jan,M,1,finished,00:20:00,01:20:00,00:40:00,02:20:00");
  });
});
