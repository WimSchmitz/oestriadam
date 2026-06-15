import { describe, it, expect } from "vitest";
import { parseParticipantsCsv } from "@/lib/csv";

const HEADER = "bib,name,type,team_name,category,relay_swimmer,relay_cyclist,relay_runner";

describe("parseParticipantsCsv", () => {
  it("parses valid individual and relay rows", () => {
    const csv = [
      HEADER,
      "1,Jan de Vries,individual,,M 30-39,,,",
      "2,Team Speed,relay,Team Speed,Relay,Ann,Bob,Cara",
    ].join("\n");
    const { rows, errors } = parseParticipantsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ bib: 1, name: "Jan de Vries", type: "individual" });
    expect(rows[1]).toMatchObject({
      bib: 2, type: "relay", teamName: "Team Speed",
      relaySwimmer: "Ann", relayCyclist: "Bob", relayRunner: "Cara",
    });
  });

  it("reports missing required headers", () => {
    const { errors } = parseParticipantsCsv("bib,name\n1,Jan");
    expect(errors.some((e) => e.includes("header"))).toBe(true);
  });

  it("reports a non-numeric bib with its line number", () => {
    const csv = `${HEADER}\nABC,Jan,individual,,,,,`;
    const { errors } = parseParticipantsCsv(csv);
    expect(errors.some((e) => e.includes("line 2") && e.toLowerCase().includes("bib"))).toBe(true);
  });

  it("reports duplicate bibs", () => {
    const csv = `${HEADER}\n1,Jan,individual,,,,,\n1,Piet,individual,,,,,`;
    const { errors } = parseParticipantsCsv(csv);
    expect(errors.some((e) => e.toLowerCase().includes("duplicate"))).toBe(true);
  });

  it("reports invalid type and missing name", () => {
    const csv = `${HEADER}\n1,,banana,,,,,`;
    const { errors } = parseParticipantsCsv(csv);
    expect(errors.some((e) => e.toLowerCase().includes("name"))).toBe(true);
    expect(errors.some((e) => e.toLowerCase().includes("type"))).toBe(true);
  });
});
