import type { ParticipantType } from "@/lib/types";

export interface ParticipantInput {
  bib: number;
  name: string;
  type: ParticipantType;
  teamName: string | null;
  category: string | null;
  gender: string | null;
  athleteNames: string | null;
}

const REQUIRED = ["bib", "name", "type"];
const ALL = [
  "bib", "name", "type", "team_name", "category", "gender", "athlete_names",
];

function splitLine(line: string): string[] {
  // Simple CSV: no quoted commas expected in this dataset. Trim each cell.
  return line.split(",").map((c) => c.trim());
}

function nullable(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

export function parseParticipantsCsv(text: string): {
  rows: ParticipantInput[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ["empty file"] };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  for (const req of REQUIRED) {
    if (!header.includes(req)) errors.push(`missing required header: ${req}`);
  }
  if (errors.length) return { rows: [], errors };

  const idx = (name: string) => header.indexOf(name);
  const has = (name: string) => ALL.includes(name) && idx(name) >= 0;

  const rows: ParticipantInput[] = [];
  // Bibs are unique per type, not globally — athlete #1 and team #1 may coexist.
  const seenBibs = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const lineNo = i + 1;
    const get = (name: string) => (has(name) ? cells[idx(name)] : undefined);

    const bibRaw = get("bib") ?? "";
    const bib = Number(bibRaw);
    if (!bibRaw || !Number.isInteger(bib)) {
      errors.push(`line ${lineNo}: invalid bib "${bibRaw}"`);
      continue;
    }
    const name = (get("name") ?? "").trim();
    if (!name) errors.push(`line ${lineNo}: missing name`);

    const typeRaw = (get("type") ?? "").toLowerCase();
    if (typeRaw !== "individual" && typeRaw !== "relay") {
      errors.push(`line ${lineNo}: invalid type "${typeRaw}" (expected individual|relay)`);
    }

    if (!name || (typeRaw !== "individual" && typeRaw !== "relay")) continue;

    // Duplicate is per (type, bib): the same number in the athlete and team
    // lists is allowed, the same number twice within one list is not.
    const dupKey = `${typeRaw}:${bib}`;
    if (seenBibs.has(dupKey)) {
      errors.push(`line ${lineNo}: duplicate bib ${bib}`);
      continue;
    }
    seenBibs.add(dupKey);
    rows.push({
      bib,
      name,
      type: typeRaw as ParticipantType,
      teamName: nullable(get("team_name")),
      category: nullable(get("category")),
      gender: nullable(get("gender")),
      athleteNames: nullable(get("athlete_names")),
    });
  }

  return { rows, errors };
}
