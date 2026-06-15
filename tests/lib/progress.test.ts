import { describe, it, expect } from "vitest";
import { effectiveSplits, computeProgress } from "@/lib/progress";
import type { Split } from "@/lib/types";

const split = (p: Split["point"], at: string, over: Partial<Split> = {}): Split => ({
  id: `${p}-${at}`,
  participantId: "x",
  point: p,
  recordedAt: at,
  stationKeyUsed: "k",
  voided: false,
  ...over,
});

describe("effectiveSplits", () => {
  it("keeps the latest non-voided split per point", () => {
    const s = [
      split("t1", "2026-06-20T10:30:00.000Z"),
      split("t1", "2026-06-20T10:31:00.000Z"), // re-record, later wins
      split("t2", "2026-06-20T11:30:00.000Z", { voided: true }),
    ];
    const eff = effectiveSplits(s);
    expect(eff.t1?.recordedAt).toBe("2026-06-20T10:31:00.000Z");
    expect(eff.t2).toBeUndefined();
  });
});

const GUN = "2026-06-20T10:00:00.000Z";

describe("computeProgress", () => {
  it("returns not_started when gun time unset", () => {
    const p = computeProgress(null, [], "active");
    expect(p.state).toBe("not_started");
    expect(p.totalMs).toBeNull();
  });
  it("returns swimming when gun set but no t1", () => {
    expect(computeProgress(GUN, [], "active").state).toBe("swimming");
  });
  it("computes swim split and cycling state at t1", () => {
    const p = computeProgress(GUN, [split("t1", "2026-06-20T10:20:00.000Z")], "active");
    expect(p.state).toBe("cycling");
    expect(p.swimMs).toBe(20 * 60_000);
    expect(p.furthest).toBe(1);
  });
  it("computes all splits and finished state", () => {
    const p = computeProgress(
      GUN,
      [
        split("t1", "2026-06-20T10:20:00.000Z"),
        split("t2", "2026-06-20T11:40:00.000Z"),
        split("finish", "2026-06-20T12:20:00.000Z"),
      ],
      "active",
    );
    expect(p.state).toBe("finished");
    expect(p.swimMs).toBe(20 * 60_000);
    expect(p.bikeMs).toBe(80 * 60_000);
    expect(p.runMs).toBe(40 * 60_000);
    expect(p.totalMs).toBe(140 * 60_000);
    expect(p.furthest).toBe(3);
  });
  it("honors dnf/dns status overrides", () => {
    expect(computeProgress(GUN, [split("t1", "2026-06-20T10:20:00.000Z")], "dnf").state).toBe("dnf");
    expect(computeProgress(GUN, [], "dns").state).toBe("dns");
  });
});
