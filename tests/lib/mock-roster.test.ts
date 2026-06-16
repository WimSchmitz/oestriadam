import { describe, it, expect } from "vitest";
import { generateMockRoster } from "@/lib/mock-roster";
import { parseParticipantsCsv } from "@/lib/csv";

describe("generateMockRoster", () => {
  it("produces a valid CSV the parser accepts with no errors", () => {
    const csv = generateMockRoster(24);
    const { rows, errors } = parseParticipantsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(24);
  });

  it("numbers each list sequentially from 1 (athlete and team bibs overlap)", () => {
    const { rows } = parseParticipantsCsv(generateMockRoster(12));
    const indivBibs = rows.filter((r) => r.type === "individual").map((r) => r.bib);
    const relayBibs = rows.filter((r) => r.type === "relay").map((r) => r.bib);
    expect(indivBibs).toEqual(Array.from({ length: indivBibs.length }, (_, i) => i + 1));
    expect(relayBibs).toEqual(Array.from({ length: relayBibs.length }, (_, i) => i + 1));
    // overlap: bib 1 exists in both lists
    expect(indivBibs).toContain(1);
    expect(relayBibs).toContain(1);
  });

  it("includes individuals with a gender and relays with athlete names", () => {
    const { rows } = parseParticipantsCsv(generateMockRoster(12));
    const relays = rows.filter((r) => r.type === "relay");
    const individuals = rows.filter((r) => r.type === "individual");
    expect(individuals.length).toBeGreaterThan(0);
    expect(relays.length).toBeGreaterThan(0);
    expect(individuals[0].gender).toBeTruthy();
    expect(relays[0].athleteNames).toBeTruthy();
    expect(relays[0].name).toBeTruthy(); // the team's name
  });

  it("is deterministic", () => {
    expect(generateMockRoster(8)).toBe(generateMockRoster(8));
  });
});
