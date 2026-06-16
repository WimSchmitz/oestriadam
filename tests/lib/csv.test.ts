import { describe, it, expect } from "vitest";
import { parseParticipantsCsv } from "@/lib/csv";

const HEADER = "bib,name,type,gender,athlete_names,category";

describe("parseParticipantsCsv", () => {
  it("parses valid individual and relay rows", () => {
    const csv = [
      HEADER,
      "1,Jan de Vries,individual,M,,M 30-39",
      "2,Team Speed,relay,,Ann Bob Cara,Relay",
    ].join("\n");
    const { rows, errors } = parseParticipantsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      bib: 1, name: "Jan de Vries", type: "individual", gender: "M", athleteNames: null,
    });
    expect(rows[1]).toMatchObject({
      bib: 2, type: "relay", athleteNames: "Ann Bob Cara", gender: null,
    });
  });

  it("reports missing required headers", () => {
    const { errors } = parseParticipantsCsv("bib,name\n1,Jan");
    expect(errors.some((e) => e.includes("header"))).toBe(true);
  });

  it("reports a non-numeric bib with its line number", () => {
    const csv = `${HEADER}\nABC,Jan,individual,M,,`;
    const { errors } = parseParticipantsCsv(csv);
    expect(errors.some((e) => e.includes("line 2") && e.toLowerCase().includes("bib"))).toBe(true);
  });

  it("reports a duplicate bib within the same type", () => {
    const csv = `${HEADER}\n1,Jan,individual,M,,\n1,Piet,individual,M,,`;
    const { errors } = parseParticipantsCsv(csv);
    expect(errors.some((e) => e.toLowerCase().includes("duplicate"))).toBe(true);
  });

  it("allows the same bib across different types (athlete #1 and team #1)", () => {
    const csv = `${HEADER}\n1,Jan,individual,M,,\n1,Team Speed,relay,,Ann Bob,`;
    const { rows, errors } = parseParticipantsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.bib, r.type])).toEqual([[1, "individual"], [1, "relay"]]);
  });

  it("reports invalid type and missing name", () => {
    const csv = `${HEADER}\n1,,banana,,,`;
    const { errors } = parseParticipantsCsv(csv);
    expect(errors.some((e) => e.toLowerCase().includes("name"))).toBe(true);
    expect(errors.some((e) => e.toLowerCase().includes("type"))).toBe(true);
  });
});
