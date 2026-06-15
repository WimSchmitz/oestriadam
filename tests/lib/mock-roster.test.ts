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

  it("numbers bibs sequentially from 1 and has unique bibs", () => {
    const { rows } = parseParticipantsCsv(generateMockRoster(12));
    expect(rows.map((r) => r.bib)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("includes both individuals and at least one relay with members", () => {
    const { rows } = parseParticipantsCsv(generateMockRoster(12));
    const relays = rows.filter((r) => r.type === "relay");
    const individuals = rows.filter((r) => r.type === "individual");
    expect(individuals.length).toBeGreaterThan(0);
    expect(relays.length).toBeGreaterThan(0);
    expect(relays[0].relaySwimmer).toBeTruthy();
    expect(relays[0].teamName).toBeTruthy();
  });

  it("is deterministic", () => {
    expect(generateMockRoster(8)).toBe(generateMockRoster(8));
  });
});
