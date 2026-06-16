import { describe, it, expect } from "vitest";
import { splitWarnings } from "@/lib/warnings";

describe("splitWarnings", () => {
  it("returns no warnings for an in-order, first-time recording", () => {
    expect(splitWarnings({ point: "t1", otherPoints: [], isRerecord: false })).toEqual([]);
    expect(splitWarnings({ point: "t2", otherPoints: ["t1"], isRerecord: false })).toEqual([]);
    expect(
      splitWarnings({ point: "finish", otherPoints: ["t1", "t2"], isRerecord: false }),
    ).toEqual([]);
  });

  it("flags a re-record at the same checkpoint as duplicate", () => {
    expect(
      splitWarnings({ point: "t1", otherPoints: [], isRerecord: true }),
    ).toContain("duplicate");
  });

  it("flags t2 recorded before t1 as out_of_order", () => {
    expect(
      splitWarnings({ point: "t2", otherPoints: [], isRerecord: false }),
    ).toContain("out_of_order");
  });

  it("flags finish recorded before t1/t2 as out_of_order", () => {
    expect(
      splitWarnings({ point: "finish", otherPoints: ["t1"], isRerecord: false }),
    ).toContain("out_of_order");
  });

  it("does not flag t1 as out_of_order (nothing precedes it)", () => {
    expect(
      splitWarnings({ point: "t1", otherPoints: ["t2"], isRerecord: false }),
    ).not.toContain("out_of_order");
  });

  it("can report both duplicate and out_of_order together", () => {
    const w = splitWarnings({ point: "finish", otherPoints: [], isRerecord: true });
    expect(w).toContain("duplicate");
    expect(w).toContain("out_of_order");
  });
});
