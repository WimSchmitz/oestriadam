# Oestriadam Live Timing Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-first live timing web app for the Oestriadam quarter-triathlon — volunteers record split times at 3 stations, spectators follow a live public leaderboard, organizers manage roster and results.

**Architecture:** A single Next.js (App Router) app on Vercel backed by Supabase Postgres. All timing/ranking/CSV logic lives in **pure, unit-tested TypeScript modules** (`src/lib/`) with zero I/O. Thin layers wrap them: Supabase data access, API route handlers (server-clock timestamps, key auth), and React pages (station, admin, leaderboard). Leaderboard updates via Supabase Realtime with automatic fallback to 10s polling.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, Supabase (`@supabase/supabase-js`), Vitest + @testing-library/react for tests.

**Design spec:** `docs/superpowers/specs/2026-06-15-oestriadam-timing-design.md`

---

## File Structure

```
src/
  lib/
    types.ts            # Domain types (Point, Participant, Split, Race, …)
    time.ts             # formatDuration, parseIso helpers — pure
    progress.ts         # effectiveSplits, computeProgress — pure
    leaderboard.ts      # buildLeaderboard ranking — pure
    csv.ts              # parseParticipantsCsv — pure
    auth.ts             # validateStationKey, validateAdminKey — pure
  server/
    supabase.ts         # server Supabase client factory (service role)
    data.ts             # DB reads/writes (getRace, recordSplit, …)
  app/
    api/
      splits/route.ts       # POST record split, POST undo
      race/route.ts         # POST set/clear gun time
      participants/route.ts # GET/POST/PUT/DELETE roster, POST import, status
    page.tsx                # public leaderboard
    leaderboard-client.tsx  # client component: realtime + polling
    station/[point]/page.tsx
    station/[point]/station-client.tsx
    admin/page.tsx
    admin/admin-client.tsx
  supabase/
    schema.sql          # tables + seed race row
tests/
  lib/*.test.ts         # unit tests for each pure module
  integration/record-flow.test.ts
```

Pure logic in `src/lib` is split by responsibility (time vs progress vs ranking vs csv vs auth) so each file is small and testable in isolation. `src/server` isolates all I/O. UI pages are thin and delegate to the pure modules.

---

## Task 1: Scaffold project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `.gitignore`, `.env.local.example`

- [ ] **Step 1: Create Next.js + TypeScript + Tailwind project non-interactively**

Run from repo root (`/home/vscode/dev/playground/oestriadam`):
```bash
npx --yes create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --no-import-alias --use-npm --turbopack --yes
```
Expected: project files generated under `src/`. If it refuses because the dir is non-empty, move `docs/` aside, scaffold, then move it back:
```bash
mv docs /tmp/oestriadam-docs && npx --yes create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --no-import-alias --use-npm --turbopack --yes && mv /tmp/oestriadam-docs docs
```

- [ ] **Step 2: Add test + Supabase dependencies**

Run:
```bash
npm install @supabase/supabase-js
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: installs succeed, `package.json` updated.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 4: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add scripts to `package.json`**

Ensure the `scripts` block contains:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Create `.env.local.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STATION_KEY=changeme-station
ADMIN_KEY=changeme-admin
```

- [ ] **Step 7: Verify build tooling works**

Run: `npm run test`
Expected: Vitest runs with "No test files found" (exit 0) — confirms config loads.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js + Supabase + Vitest project"
```

---

## Task 2: Domain types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create the types file**

```ts
export type Point = "t1" | "t2" | "finish";
export const POINTS: Point[] = ["t1", "t2", "finish"];

export type ParticipantType = "individual" | "relay";
export type ParticipantStatus = "active" | "dnf" | "dns";

export interface Participant {
  id: string;
  bib: number;
  name: string;
  type: ParticipantType;
  teamName: string | null;
  category: string | null;
  relaySwimmer: string | null;
  relayCyclist: string | null;
  relayRunner: string | null;
  status: ParticipantStatus;
}

export interface Split {
  id: string;
  participantId: string;
  point: Point;
  recordedAt: string; // ISO 8601
  stationKeyUsed: string;
  voided: boolean;
}

export interface Race {
  id: string;
  eventName: string;
  gunTime: string | null; // ISO 8601, null until started
}

export type RaceState =
  | "dns"
  | "dnf"
  | "not_started"
  | "swimming"
  | "cycling"
  | "running"
  | "finished";

export interface Progress {
  state: RaceState;
  swimMs: number | null;
  bikeMs: number | null;
  runMs: number | null;
  totalMs: number | null;
  furthest: 0 | 1 | 2 | 3; // 0 none, 1 t1, 2 t2, 3 finish
  furthestAt: string | null; // ISO of the furthest checkpoint
}

export interface LeaderboardEntry {
  participant: Participant;
  progress: Progress;
  rank: number | null; // null for DNF/DNS/not-started
  categoryRank: number | null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts && git commit -m "feat: add domain types"
```

---

## Task 3: Time helpers

**Files:**
- Create: `src/lib/time.ts`
- Test: `tests/lib/time.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatDuration, diffMs } from "@/lib/time";

describe("formatDuration", () => {
  it("formats whole seconds as HH:MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(1000)).toBe("00:00:01");
    expect(formatDuration(61_000)).toBe("00:01:01");
    expect(formatDuration(3_661_000)).toBe("01:01:01");
  });
  it("renders placeholder for null", () => {
    expect(formatDuration(null)).toBe("--:--:--");
  });
  it("floors sub-second remainders", () => {
    expect(formatDuration(1999)).toBe("00:00:01");
  });
});

describe("diffMs", () => {
  it("returns ms between two ISO strings", () => {
    expect(diffMs("2026-06-20T10:00:00.000Z", "2026-06-20T10:00:05.000Z")).toBe(5000);
  });
  it("returns null if either input is null", () => {
    expect(diffMs(null, "2026-06-20T10:00:05.000Z")).toBeNull();
    expect(diffMs("2026-06-20T10:00:00.000Z", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/time.test.ts`
Expected: FAIL — module `@/lib/time` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export function diffMs(from: string | null, to: string | null): number | null {
  if (from === null || to === null) return null;
  return new Date(to).getTime() - new Date(from).getTime();
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "--:--:--";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/time.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts tests/lib/time.test.ts && git commit -m "feat: add time helpers"
```

---

## Task 4: Effective splits + progress computation

**Files:**
- Create: `src/lib/progress.ts`
- Test: `tests/lib/progress.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/progress.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Point, Progress, ParticipantStatus, Split } from "@/lib/types";
import { diffMs } from "@/lib/time";

export function effectiveSplits(splits: Split[]): Partial<Record<Point, Split>> {
  const out: Partial<Record<Point, Split>> = {};
  for (const s of splits) {
    if (s.voided) continue;
    const cur = out[s.point];
    if (!cur || s.recordedAt > cur.recordedAt) out[s.point] = s;
  }
  return out;
}

export function computeProgress(
  gunTime: string | null,
  splits: Split[],
  status: ParticipantStatus,
): Progress {
  const eff = effectiveSplits(splits);
  const t1 = eff.t1?.recordedAt ?? null;
  const t2 = eff.t2?.recordedAt ?? null;
  const finish = eff.finish?.recordedAt ?? null;

  const swimMs = diffMs(gunTime, t1);
  const bikeMs = diffMs(t1, t2);
  const runMs = diffMs(t2, finish);
  const totalMs = diffMs(gunTime, finish);

  const furthest = finish ? 3 : t2 ? 2 : t1 ? 1 : 0;
  const furthestAt = finish ?? t2 ?? t1 ?? null;

  let state: Progress["state"];
  if (status === "dns") state = "dns";
  else if (status === "dnf") state = "dnf";
  else if (!gunTime) state = "not_started";
  else if (finish) state = "finished";
  else if (t2) state = "running";
  else if (t1) state = "cycling";
  else state = "swimming";

  return { state, swimMs, bikeMs, runMs, totalMs, furthest, furthestAt };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress.ts tests/lib/progress.test.ts && git commit -m "feat: add split/progress computation"
```

---

## Task 5: Leaderboard ranking

**Files:**
- Create: `src/lib/leaderboard.ts`
- Test: `tests/lib/leaderboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildLeaderboard } from "@/lib/leaderboard";
import type { Participant, Split, Race } from "@/lib/types";

const race: Race = { id: "r", eventName: "Oestriadam", gunTime: "2026-06-20T10:00:00.000Z" };

const p = (id: string, bib: number, over: Partial<Participant> = {}): Participant => ({
  id, bib, name: `A${bib}`, type: "individual", teamName: null,
  category: "M", relaySwimmer: null, relayCyclist: null, relayRunner: null,
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

  it("assigns category rank within category", () => {
    const participants = [
      p("a", 1, { category: "M" }),
      p("b", 2, { category: "V" }),
      p("c", 3, { category: "M" }),
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
    ];
    const lb = buildLeaderboard(race, participants, splits);
    const byBib = Object.fromEntries(lb.map((e) => [e.participant.bib, e]));
    expect(byBib[3].categoryRank).toBe(1); // fastest M
    expect(byBib[1].categoryRank).toBe(2); // slower M
    expect(byBib[2].categoryRank).toBe(1); // only V
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/leaderboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { LeaderboardEntry, Participant, Progress, Race, Split } from "@/lib/types";
import { computeProgress } from "@/lib/progress";

function isRankable(prog: Progress): boolean {
  if (prog.state === "dnf" || prog.state === "dns" || prog.state === "not_started") return false;
  return prog.furthest > 0; // must have reached at least t1 to be ranked
}

// Lower sort key = better position.
function sortKey(prog: Progress): [number, number] {
  if (prog.state === "finished" && prog.totalMs !== null) {
    return [0, prog.totalMs]; // finishers first, by total time
  }
  // in progress: further checkpoint is better (negate), then earlier time is better
  const at = prog.furthestAt ? new Date(prog.furthestAt).getTime() : Infinity;
  return [1 - prog.furthest / 10, at];
}

export function buildLeaderboard(
  race: Race,
  participants: Participant[],
  splits: Split[],
): LeaderboardEntry[] {
  const byParticipant = new Map<string, Split[]>();
  for (const s of splits) {
    const arr = byParticipant.get(s.participantId) ?? [];
    arr.push(s);
    byParticipant.set(s.participantId, arr);
  }

  const entries = participants.map((participant) => {
    const progress = computeProgress(
      race.gunTime,
      byParticipant.get(participant.id) ?? [],
      participant.status,
    );
    return { participant, progress, rank: null as number | null, categoryRank: null as number | null };
  });

  entries.sort((a, b) => {
    const ra = isRankable(a.progress), rb = isRankable(b.progress);
    if (ra !== rb) return ra ? -1 : 1; // rankable first
    if (!ra && !rb) return a.participant.bib - b.participant.bib; // stable-ish
    const ka = sortKey(a.progress), kb = sortKey(b.progress);
    return ka[0] - kb[0] || ka[1] - kb[1] || a.participant.bib - b.participant.bib;
  });

  let rank = 0;
  const catCounter = new Map<string, number>();
  for (const e of entries) {
    if (!isRankable(e.progress)) continue;
    e.rank = ++rank;
    const cat = e.participant.category ?? "—";
    const next = (catCounter.get(cat) ?? 0) + 1;
    catCounter.set(cat, next);
    e.categoryRank = next;
  }

  return entries;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/leaderboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.ts tests/lib/leaderboard.test.ts && git commit -m "feat: add leaderboard ranking"
```

---

## Task 6: CSV parser

**Files:**
- Create: `src/lib/csv.ts`
- Test: `tests/lib/csv.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/csv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { ParticipantType } from "@/lib/types";

export interface ParticipantInput {
  bib: number;
  name: string;
  type: ParticipantType;
  teamName: string | null;
  category: string | null;
  relaySwimmer: string | null;
  relayCyclist: string | null;
  relayRunner: string | null;
}

const REQUIRED = ["bib", "name", "type"];
const ALL = [
  "bib", "name", "type", "team_name", "category",
  "relay_swimmer", "relay_cyclist", "relay_runner",
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
  const seenBibs = new Set<number>();

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
    if (seenBibs.has(bib)) {
      errors.push(`line ${lineNo}: duplicate bib ${bib}`);
      continue;
    }
    const name = (get("name") ?? "").trim();
    if (!name) errors.push(`line ${lineNo}: missing name`);

    const typeRaw = (get("type") ?? "").toLowerCase();
    if (typeRaw !== "individual" && typeRaw !== "relay") {
      errors.push(`line ${lineNo}: invalid type "${typeRaw}" (expected individual|relay)`);
    }

    if (!name || (typeRaw !== "individual" && typeRaw !== "relay")) continue;

    seenBibs.add(bib);
    rows.push({
      bib,
      name,
      type: typeRaw as ParticipantType,
      teamName: nullable(get("team_name")),
      category: nullable(get("category")),
      relaySwimmer: nullable(get("relay_swimmer")),
      relayCyclist: nullable(get("relay_cyclist")),
      relayRunner: nullable(get("relay_runner")),
    });
  }

  return { rows, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/csv.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts tests/lib/csv.test.ts && git commit -m "feat: add CSV participant parser"
```

---

## Task 7: Key auth helpers

**Files:**
- Create: `src/lib/auth.ts`
- Test: `tests/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { keyIsValid } from "@/lib/auth";

describe("keyIsValid", () => {
  it("returns true only on exact non-empty match", () => {
    expect(keyIsValid("abc", "abc")).toBe(true);
    expect(keyIsValid("abc", "abcd")).toBe(false);
    expect(keyIsValid("abc", "")).toBe(false);
    expect(keyIsValid("", "")).toBe(false); // empty expected => always false
    expect(keyIsValid(undefined, "abc")).toBe(false);
    expect(keyIsValid("abc", null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// Pure comparison so it is unit-testable. Route handlers pass the env value in.
export function keyIsValid(expected: string | undefined, provided: string | null | undefined): boolean {
  if (!expected) return false; // never allow access if no key configured
  return provided === expected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/lib/auth.test.ts && git commit -m "feat: add key validation helper"
```

---

## Task 8: Supabase schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write the schema**

```sql
-- Run this in the Supabase SQL editor for the project.

create table if not exists race (
  id uuid primary key default gen_random_uuid(),
  event_name text not null default 'Oestriadam',
  gun_time timestamptz
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  bib integer not null unique,
  name text not null,
  type text not null check (type in ('individual','relay')),
  team_name text,
  category text,
  relay_swimmer text,
  relay_cyclist text,
  relay_runner text,
  status text not null default 'active' check (status in ('active','dnf','dns'))
);

create table if not exists splits (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  point text not null check (point in ('t1','t2','finish')),
  recorded_at timestamptz not null default now(),
  station_key_used text,
  voided boolean not null default false
);

create index if not exists splits_participant_idx on splits(participant_id);

-- Seed the single race row.
insert into race (event_name) select 'Oestriadam'
where not exists (select 1 from race);

-- Realtime: publish splits, race, participants so the leaderboard can subscribe.
alter publication supabase_realtime add table splits;
alter publication supabase_realtime add table race;
alter publication supabase_realtime add table participants;
```

- [ ] **Step 2: Apply it (manual)**

Create a Supabase project, open SQL Editor, paste and run `supabase/schema.sql`. Copy the project URL, anon key, and service-role key into `.env.local` (based on `.env.local.example`).
Expected: 3 tables created, one `race` row present.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql && git commit -m "feat: add Supabase schema"
```

---

## Task 9: Server data access layer

**Files:**
- Create: `src/server/supabase.ts`, `src/server/data.ts`

- [ ] **Step 1: Create the server Supabase client factory**

`src/server/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key. Never import this in client code.
export function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: Create the data access functions**

`src/server/data.ts`:
```ts
import { serverSupabase } from "@/server/supabase";
import type { Participant, Race, Split, Point, ParticipantStatus } from "@/lib/types";
import type { ParticipantInput } from "@/lib/csv";

// --- mappers (snake_case DB -> camelCase domain) ---
type RaceRow = { id: string; event_name: string; gun_time: string | null };
type PartRow = {
  id: string; bib: number; name: string; type: "individual" | "relay";
  team_name: string | null; category: string | null;
  relay_swimmer: string | null; relay_cyclist: string | null; relay_runner: string | null;
  status: ParticipantStatus;
};
type SplitRow = {
  id: string; participant_id: string; point: Point;
  recorded_at: string; station_key_used: string | null; voided: boolean;
};

const toRace = (r: RaceRow): Race => ({ id: r.id, eventName: r.event_name, gunTime: r.gun_time });
const toPart = (p: PartRow): Participant => ({
  id: p.id, bib: p.bib, name: p.name, type: p.type, teamName: p.team_name,
  category: p.category, relaySwimmer: p.relay_swimmer, relayCyclist: p.relay_cyclist,
  relayRunner: p.relay_runner, status: p.status,
});
const toSplit = (s: SplitRow): Split => ({
  id: s.id, participantId: s.participant_id, point: s.point,
  recordedAt: s.recorded_at, stationKeyUsed: s.station_key_used ?? "", voided: s.voided,
});

export async function getRace(): Promise<Race> {
  const db = serverSupabase();
  const { data, error } = await db.from("race").select("*").limit(1).single();
  if (error) throw error;
  return toRace(data as RaceRow);
}

export async function setGunTime(gunTime: string | null): Promise<void> {
  const db = serverSupabase();
  const race = await getRace();
  const { error } = await db.from("race").update({ gun_time: gunTime }).eq("id", race.id);
  if (error) throw error;
}

export async function getParticipants(): Promise<Participant[]> {
  const db = serverSupabase();
  const { data, error } = await db.from("participants").select("*").order("bib");
  if (error) throw error;
  return (data as PartRow[]).map(toPart);
}

export async function getParticipantByBib(bib: number): Promise<Participant | null> {
  const db = serverSupabase();
  const { data } = await db.from("participants").select("*").eq("bib", bib).maybeSingle();
  return data ? toPart(data as PartRow) : null;
}

export async function getSplits(): Promise<Split[]> {
  const db = serverSupabase();
  const { data, error } = await db.from("splits").select("*").order("recorded_at");
  if (error) throw error;
  return (data as SplitRow[]).map(toSplit);
}

export async function getSplitsForParticipant(participantId: string): Promise<Split[]> {
  const db = serverSupabase();
  const { data, error } = await db
    .from("splits").select("*").eq("participant_id", participantId).order("recorded_at");
  if (error) throw error;
  return (data as SplitRow[]).map(toSplit);
}

// Record a split. Voids any prior non-voided split at the same point first (re-record supersedes).
export async function recordSplit(
  participantId: string, point: Point, stationKey: string,
): Promise<Split> {
  const db = serverSupabase();
  await db.from("splits")
    .update({ voided: true })
    .eq("participant_id", participantId).eq("point", point).eq("voided", false);
  const { data, error } = await db.from("splits")
    .insert({ participant_id: participantId, point, station_key_used: stationKey })
    .select("*").single(); // recorded_at defaults to now() (server clock)
  if (error) throw error;
  return toSplit(data as SplitRow);
}

export async function voidSplit(splitId: string): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("splits").update({ voided: true }).eq("id", splitId);
  if (error) throw error;
}

export async function upsertParticipants(rows: ParticipantInput[]): Promise<void> {
  const db = serverSupabase();
  const payload = rows.map((r) => ({
    bib: r.bib, name: r.name, type: r.type, team_name: r.teamName,
    category: r.category, relay_swimmer: r.relaySwimmer,
    relay_cyclist: r.relayCyclist, relay_runner: r.relayRunner,
  }));
  const { error } = await db.from("participants").upsert(payload, { onConflict: "bib" });
  if (error) throw error;
}

export async function setParticipantStatus(id: string, status: ParticipantStatus): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("participants").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteParticipant(id: string): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("participants").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/server/ && git commit -m "feat: add Supabase data access layer"
```

---

## Task 10: API route — record & undo splits

**Files:**
- Create: `src/app/api/splits/route.ts`

- [ ] **Step 1: Implement the route handler**

```ts
import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import { getParticipantByBib, recordSplit, voidSplit, getSplits } from "@/server/data";
import { POINTS, type Point } from "@/lib/types";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const key = req.headers.get("x-station-key") ?? new URL(req.url).searchParams.get("key");
  return keyIsValid(process.env.STATION_KEY, key);
}

// POST { action: "record", bib, point } | { action: "undo", splitId }
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();

  if (body.action === "undo") {
    if (!body.splitId) return NextResponse.json({ error: "splitId required" }, { status: 400 });
    await voidSplit(body.splitId);
    return NextResponse.json({ ok: true });
  }

  const point = body.point as Point;
  if (!POINTS.includes(point)) return NextResponse.json({ error: "bad point" }, { status: 400 });
  const bib = Number(body.bib);
  if (!Number.isInteger(bib)) return NextResponse.json({ error: "bad bib" }, { status: 400 });

  const participant = await getParticipantByBib(bib);
  if (!participant) {
    // Unknown bib: still allow recording is impossible without a participant row,
    // so report it so the station UI can warn and the admin reconciles.
    return NextResponse.json({ error: "unknown_bib", bib }, { status: 404 });
  }
  const split = await recordSplit(participant.id, point, process.env.STATION_KEY ?? "");
  return NextResponse.json({ ok: true, split, participant });
}

// GET recent splits for a point (?point=t1) for the station "recent" list.
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const point = new URL(req.url).searchParams.get("point");
  const all = await getSplits();
  const filtered = all.filter((s) => !s.voided && (!point || s.point === point));
  return NextResponse.json({ splits: filtered.slice(-15).reverse() });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/splits/route.ts && git commit -m "feat: add splits record/undo API"
```

---

## Task 11: API routes — race control & roster admin

**Files:**
- Create: `src/app/api/race/route.ts`, `src/app/api/participants/route.ts`

- [ ] **Step 1: Implement the race control route**

`src/app/api/race/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import { getRace, setGunTime } from "@/server/data";

export const dynamic = "force-dynamic";

function adminAuthed(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") ?? new URL(req.url).searchParams.get("key");
  return keyIsValid(process.env.ADMIN_KEY, key);
}

export async function GET() {
  return NextResponse.json({ race: await getRace() });
}

// POST { action: "start" } sets gun_time=now; { action: "clear" } resets it.
export async function POST(req: NextRequest) {
  if (!adminAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.action === "start") {
    await setGunTime(new Date().toISOString());
  } else if (body.action === "clear") {
    await setGunTime(null);
  } else {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }
  return NextResponse.json({ race: await getRace() });
}
```

- [ ] **Step 2: Implement the roster admin route**

`src/app/api/participants/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import {
  getParticipants, upsertParticipants, setParticipantStatus, deleteParticipant,
} from "@/server/data";
import { parseParticipantsCsv } from "@/lib/csv";
import type { ParticipantStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function adminAuthed(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") ?? new URL(req.url).searchParams.get("key");
  return keyIsValid(process.env.ADMIN_KEY, key);
}

export async function GET() {
  return NextResponse.json({ participants: await getParticipants() });
}

// POST handles: { action: "import", csv } | { action: "add", row } |
//   { action: "status", id, status } | { action: "delete", id }
export async function POST(req: NextRequest) {
  if (!adminAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();

  if (body.action === "import") {
    const { rows, errors } = parseParticipantsCsv(String(body.csv ?? ""));
    if (errors.length) return NextResponse.json({ error: "validation", errors }, { status: 400 });
    await upsertParticipants(rows);
    return NextResponse.json({ ok: true, imported: rows.length });
  }
  if (body.action === "add") {
    const { rows, errors } = parseParticipantsCsv(
      "bib,name,type,team_name,category,relay_swimmer,relay_cyclist,relay_runner\n" +
        [body.row.bib, body.row.name, body.row.type, body.row.teamName ?? "",
         body.row.category ?? "", body.row.relaySwimmer ?? "",
         body.row.relayCyclist ?? "", body.row.relayRunner ?? ""].join(","),
    );
    if (errors.length) return NextResponse.json({ error: "validation", errors }, { status: 400 });
    await upsertParticipants(rows);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "status") {
    await setParticipantStatus(body.id, body.status as ParticipantStatus);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete") {
    await deleteParticipant(body.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad action" }, { status: 400 });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/race/route.ts src/app/api/participants/route.ts && git commit -m "feat: add race control and roster admin APIs"
```

---

## Task 12: Public leaderboard page

**Files:**
- Create: `src/app/page.tsx`, `src/app/leaderboard-client.tsx`, `src/lib/browser-supabase.ts`

> **UI note:** Use the `frontend-design` skill for visual polish on this and the next two tasks. Match Oestriadam's clean, minimalist branding (simple typography, restrained palette). The code below is functional scaffolding — make it look nice, but keep the data wiring intact.

- [ ] **Step 1: Create the browser Supabase client**

`src/lib/browser-supabase.ts`:
```ts
"use client";
import { createClient } from "@supabase/supabase-js";

export const browserSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

- [ ] **Step 2: Create the server page (initial data fetch)**

`src/app/page.tsx`:
```tsx
import { getRace, getParticipants, getSplits } from "@/server/data";
import { buildLeaderboard } from "@/lib/leaderboard";
import { LeaderboardClient } from "./leaderboard-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [race, participants, splits] = await Promise.all([
    getRace(), getParticipants(), getSplits(),
  ]);
  const initial = buildLeaderboard(race, participants, splits);
  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-bold mb-4">{race.eventName} — Live</h1>
      <LeaderboardClient
        initialEntries={initial}
        race={race}
        participants={participants}
      />
    </main>
  );
}
```

- [ ] **Step 3: Create the client component with realtime + polling fallback**

`src/app/leaderboard-client.tsx`:
```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { browserSupabase } from "@/lib/browser-supabase";
import { buildLeaderboard } from "@/lib/leaderboard";
import { computeProgress } from "@/lib/progress";
import { formatDuration, diffMs } from "@/lib/time";
import type { LeaderboardEntry, Participant, Race, Split } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  swimming: "🏊 swimming", cycling: "🚴 cycling", running: "🏃 running",
  finished: "✅ finished", dnf: "DNF", dns: "DNS", not_started: "—",
};

async function fetchSplits(): Promise<Split[]> {
  // Public read of splits via the Supabase anon client (no station key needed).
  const { data } = await browserSupabase.from("splits").select("*").order("recorded_at");
  return (data ?? []).map((s: any) => ({
    id: s.id, participantId: s.participant_id, point: s.point,
    recordedAt: s.recorded_at, stationKeyUsed: s.station_key_used ?? "", voided: s.voided,
  }));
}

export function LeaderboardClient({
  initialEntries, race, participants,
}: {
  initialEntries: LeaderboardEntry[]; race: Race; participants: Participant[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState<"all" | "individual" | "relay">("all");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const splits = await fetchSplits();
    setEntries(buildLeaderboard(race, participants, splits));
  }, [race, participants]);

  // Realtime subscription; on any change, refresh. Falls back to polling below.
  useEffect(() => {
    const ch = browserSupabase
      .channel("live")
      .on("postgres_changes", { event: "*", schema: "public", table: "splits" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "race" }, refresh)
      .subscribe();
    return () => { browserSupabase.removeChannel(ch); };
  }, [refresh]);

  // Polling fallback (10s) + 1s ticking clock for in-progress elapsed times.
  useEffect(() => {
    const poll = setInterval(refresh, 10_000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [refresh]);

  const now = new Date().toISOString();
  const shown = entries.filter((e) => filter === "all" || e.participant.type === filter);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(["all", "individual", "relay"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded ${filter === f ? "bg-black text-white" : "bg-gray-200"}`}>
            {f === "all" ? "All" : f === "individual" ? "Individuals" : "Relays"}
          </button>
        ))}
      </div>
      <ul className="divide-y">
        {shown.map((e) => {
          // For in-progress, show live elapsed from gun to now; for finished, total.
          const live = e.progress.state === "finished"
            ? e.progress.totalMs
            : diffMs(race.gunTime, now);
          return (
            <li key={e.participant.id} className="flex items-center gap-3 py-2">
              <span className="w-8 text-right font-mono">{e.rank ?? "–"}</span>
              <span className="w-10 text-gray-500">#{e.participant.bib}</span>
              <span className="flex-1">
                {e.participant.type === "relay"
                  ? e.participant.teamName ?? e.participant.name
                  : e.participant.name}
                {e.participant.category && (
                  <span className="ml-2 text-xs text-gray-400">
                    {e.participant.category}
                    {e.categoryRank ? ` · ${e.categoryRank}` : ""}
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-600">{STATUS_LABEL[e.progress.state]}</span>
              <span className="font-mono">{formatDuration(live)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-gray-400 mt-4" key={tick}>Updates live</p>
    </div>
  );
}
```

- [ ] **Step 4: Enable public read in Supabase (manual)**

In Supabase SQL editor, allow anon read of the three tables (RLS off is fine for a public read-only event, OR add read policies):
```sql
alter table race enable row level security;
alter table participants enable row level security;
alter table splits enable row level security;
create policy "public read race" on race for select using (true);
create policy "public read participants" on participants for select using (true);
create policy "public read splits" on splits for select using (true);
```
(Writes go through the service-role key in API routes, which bypasses RLS.)

- [ ] **Step 5: Verify it renders**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: leaderboard loads with seeded/imported participants (empty list is fine pre-import). No console errors about Supabase env.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/leaderboard-client.tsx src/lib/browser-supabase.ts && git commit -m "feat: add public live leaderboard"
```

---

## Task 13: Station timing page

**Files:**
- Create: `src/app/station/[point]/page.tsx`, `src/app/station/[point]/station-client.tsx`

- [ ] **Step 1: Create the server page (reads point param, validates it)**

`src/app/station/[point]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { POINTS, type Point } from "@/lib/types";
import { StationClient } from "./station-client";

const LABELS: Record<Point, string> = {
  t1: "T1 — Swim → Bike", t2: "T2 — Bike → Run", finish: "Finish",
};

export default async function StationPage({
  params,
}: {
  params: Promise<{ point: string }>;
}) {
  const { point } = await params;
  if (!POINTS.includes(point as Point)) notFound();
  return <StationClient point={point as Point} label={LABELS[point as Point]} />;
}
```

- [ ] **Step 2: Create the station client**

`src/app/station/[point]/station-client.tsx`:
```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import type { Point } from "@/lib/types";
import { formatDuration } from "@/lib/time";

const KEY_STORAGE = "oestriadam-station-key";

export function StationClient({ point, label }: { point: Point; label: string }) {
  const [key, setKey] = useState<string>("");
  const [bib, setBib] = useState("");
  const [recent, setRecent] = useState<any[]>([]);
  const [toast, setToast] = useState<string>("");

  useEffect(() => { setKey(localStorage.getItem(KEY_STORAGE) ?? ""); }, []);

  const loadRecent = useCallback(async () => {
    const res = await fetch(`/api/splits?point=${point}`, { headers: { "x-station-key": key } });
    if (res.ok) setRecent((await res.json()).splits ?? []);
  }, [point, key]);

  useEffect(() => { if (key) loadRecent(); }, [key, loadRecent]);

  async function record() {
    if (!bib) return;
    const res = await fetch("/api/splits", {
      method: "POST",
      headers: { "content-type": "application/json", "x-station-key": key },
      body: JSON.stringify({ action: "record", bib: Number(bib), point }),
    });
    const data = await res.json();
    if (res.ok) {
      setToast(`✅ #${data.participant.bib} ${data.participant.name}`);
      setBib("");
      loadRecent();
    } else if (data.error === "unknown_bib") {
      setToast(`⚠️ Unknown bib #${bib} — tell admin`);
    } else if (res.status === 401) {
      setToast("🔒 Wrong station key");
    } else {
      setToast(`Error: ${data.error}`);
    }
    setTimeout(() => setToast(""), 4000);
  }

  async function undo(splitId: string) {
    await fetch("/api/splits", {
      method: "POST",
      headers: { "content-type": "application/json", "x-station-key": key },
      body: JSON.stringify({ action: "undo", splitId }),
    });
    loadRecent();
  }

  if (!key) {
    return (
      <main className="p-6 max-w-sm mx-auto">
        <h1 className="text-xl font-bold mb-3">{label}</h1>
        <p className="mb-2">Enter station key:</p>
        <input className="border p-2 w-full" onChange={(e) => setKey(e.target.value)}
          onBlur={(e) => localStorage.setItem(KEY_STORAGE, e.target.value)} />
      </main>
    );
  }

  return (
    <main className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-3">{label}</h1>
      <input
        inputMode="numeric" value={bib}
        onChange={(e) => setBib(e.target.value.replace(/\D/g, ""))}
        placeholder="Bib #"
        className="border-2 p-4 text-3xl w-full text-center font-mono mb-3"
      />
      <button onClick={record}
        className="w-full bg-green-600 text-white text-2xl py-5 rounded-lg active:bg-green-700">
        RECORD
      </button>
      {toast && <p className="mt-3 text-center text-lg">{toast}</p>}
      <h2 className="mt-6 mb-2 font-semibold">Recent</h2>
      <ul className="divide-y text-sm">
        {recent.map((s) => (
          <li key={s.id} className="flex justify-between py-1">
            <span className="font-mono">{new Date(s.recordedAt).toLocaleTimeString()}</span>
            <button className="text-red-600" onClick={() => undo(s.id)}>undo</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Verify on a phone-sized viewport**

Run: `npm run dev`, open `http://localhost:3000/station/t1`.
Expected: prompts for key; after entering `STATION_KEY` value, shows keypad. Recording a known bib shows a confirmation toast; unknown bib shows a warning.

- [ ] **Step 4: Commit**

```bash
git add "src/app/station" && git commit -m "feat: add station timing page"
```

---

## Task 14: Admin page

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/admin-client.tsx`

- [ ] **Step 1: Create the admin server page**

`src/app/admin/page.tsx`:
```tsx
import { AdminClient } from "./admin-client";
export const dynamic = "force-dynamic";
export default function AdminPage() {
  return <AdminClient />;
}
```

- [ ] **Step 2: Create the admin client**

`src/app/admin/admin-client.tsx`:
```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import type { Participant, Race } from "@/lib/types";

const KEY_STORAGE = "oestriadam-admin-key";

export function AdminClient() {
  const [key, setKey] = useState("");
  const [race, setRace] = useState<Race | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { setKey(localStorage.getItem(KEY_STORAGE) ?? ""); }, []);

  const headers = useCallback(
    () => ({ "content-type": "application/json", "x-admin-key": key }),
    [key],
  );

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch("/api/race").then((x) => x.json()),
      fetch("/api/participants").then((x) => x.json()),
    ]);
    setRace(r.race);
    setParticipants(p.participants ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function raceAction(action: "start" | "clear") {
    const res = await fetch("/api/race", { method: "POST", headers: headers(), body: JSON.stringify({ action }) });
    if (res.ok) setRace((await res.json()).race);
    else setMsg("🔒 wrong admin key");
  }

  async function importCsv() {
    const res = await fetch("/api/participants", {
      method: "POST", headers: headers(), body: JSON.stringify({ action: "import", csv }),
    });
    const data = await res.json();
    if (res.ok) { setMsg(`Imported ${data.imported}`); load(); }
    else setMsg((data.errors ?? [data.error]).join("; "));
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/participants", {
      method: "POST", headers: headers(), body: JSON.stringify({ action: "status", id, status }),
    });
    load();
  }

  if (!key) {
    return (
      <main className="p-6 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-3">Admin</h1>
        <input className="border p-2 w-full" placeholder="Admin key"
          onBlur={(e) => { localStorage.setItem(KEY_STORAGE, e.target.value); setKey(e.target.value); }} />
      </main>
    );
  }

  return (
    <main className="p-4 max-w-2xl mx-auto space-y-6">
      <section>
        <h1 className="text-xl font-bold">Admin</h1>
        {msg && <p className="text-sm text-blue-700">{msg}</p>}
      </section>

      <section className="border rounded p-3">
        <h2 className="font-semibold mb-2">Race</h2>
        <p className="mb-2">Gun time: {race?.gunTime ?? "not started"}</p>
        <button className="bg-green-600 text-white px-4 py-2 rounded mr-2" onClick={() => raceAction("start")}>
          START RACE
        </button>
        <button className="bg-gray-300 px-4 py-2 rounded" onClick={() => raceAction("clear")}>
          Clear
        </button>
      </section>

      <section className="border rounded p-3">
        <h2 className="font-semibold mb-2">Import roster (CSV)</h2>
        <p className="text-xs text-gray-500 mb-1">
          Header: bib,name,type,team_name,category,relay_swimmer,relay_cyclist,relay_runner
        </p>
        <textarea className="border w-full h-32 p-2 font-mono text-sm"
          value={csv} onChange={(e) => setCsv(e.target.value)} />
        <button className="bg-black text-white px-4 py-2 rounded mt-2" onClick={importCsv}>Import</button>
      </section>

      <section className="border rounded p-3">
        <h2 className="font-semibold mb-2">Participants ({participants.length})</h2>
        <ul className="divide-y text-sm">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1">
              <span className="w-10">#{p.bib}</span>
              <span className="flex-1">{p.teamName ?? p.name}</span>
              <span className="text-gray-400">{p.status}</span>
              <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)}
                className="border text-xs">
                <option value="active">active</option>
                <option value="dnf">DNF</option>
                <option value="dns">DNS</option>
              </select>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run dev`, open `http://localhost:3000/admin`.
Expected: prompts for admin key; after entry, can paste CSV → import → participants appear; START RACE sets a gun time; status dropdown updates.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin" && git commit -m "feat: add admin page"
```

---

## Task 15: Integration test — record flow

**Files:**
- Test: `tests/integration/record-flow.test.ts`

This test exercises the pure pipeline end-to-end (CSV → participants → splits → leaderboard) without hitting Supabase, proving the modules compose correctly.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { parseParticipantsCsv } from "@/lib/csv";
import { buildLeaderboard } from "@/lib/leaderboard";
import type { Participant, Race, Split } from "@/lib/types";

describe("record flow (CSV -> leaderboard)", () => {
  it("imports a roster and ranks a finisher ahead of an in-progress athlete", () => {
    const csv = [
      "bib,name,type,team_name,category,relay_swimmer,relay_cyclist,relay_runner",
      "1,Jan,individual,,M,,,",
      "2,Piet,individual,,M,,,",
    ].join("\n");
    const { rows, errors } = parseParticipantsCsv(csv);
    expect(errors).toEqual([]);

    const participants: Participant[] = rows.map((r, i) => ({
      id: `p${i}`, bib: r.bib, name: r.name, type: r.type, teamName: r.teamName,
      category: r.category, relaySwimmer: r.relaySwimmer, relayCyclist: r.relayCyclist,
      relayRunner: r.relayRunner, status: "active",
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
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: PASS — all unit + integration tests green.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/record-flow.test.ts && git commit -m "test: add CSV-to-leaderboard integration test"
```

---

## Task 16: Results CSV export

**Files:**
- Create: `src/lib/results-csv.ts`, `src/app/api/results/route.ts`
- Test: `tests/lib/results-csv.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/results-csv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/results-csv.ts`:
```ts
import type { LeaderboardEntry } from "@/lib/types";
import { formatDuration } from "@/lib/time";

const HEADER = "rank,bib,name,category,category_rank,status,swim,bike,run,total";

function cell(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toResultsCsv(entries: LeaderboardEntry[]): string {
  const rows = entries.map((e) => {
    const p = e.participant;
    const name = p.type === "relay" ? p.teamName ?? p.name : p.name;
    return [
      e.rank, p.bib, name, p.category, e.categoryRank, e.progress.state,
      formatDuration(e.progress.swimMs), formatDuration(e.progress.bikeMs),
      formatDuration(e.progress.runMs), formatDuration(e.progress.totalMs),
    ].map(cell).join(",");
  });
  return [HEADER, ...rows].join("\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/results-csv.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the export route**

`src/app/api/results/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { keyIsValid } from "@/lib/auth";
import { getRace, getParticipants, getSplits } from "@/server/data";
import { buildLeaderboard } from "@/lib/leaderboard";
import { toResultsCsv } from "@/lib/results-csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key") ?? new URL(req.url).searchParams.get("key");
  if (!keyIsValid(process.env.ADMIN_KEY, key)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [race, participants, splits] = await Promise.all([
    getRace(), getParticipants(), getSplits(),
  ]);
  const csv = toResultsCsv(buildLeaderboard(race, participants, splits));
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": 'attachment; filename="oestriadam-results.csv"',
    },
  });
}
```

- [ ] **Step 6: Add an export link to the admin page**

In `src/app/admin/admin-client.tsx`, add inside the Race `<section>` (after the Clear button):
```tsx
<a className="bg-blue-600 text-white px-4 py-2 rounded ml-2"
   href={`/api/results?key=${encodeURIComponent(key)}`}>
  Export results CSV
</a>
```

- [ ] **Step 7: Run the full suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/results-csv.ts tests/lib/results-csv.test.ts src/app/api/results/route.ts src/app/admin/admin-client.tsx && git commit -m "feat: add results CSV export"
```

---

## Task 17: Docs & deployment

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

```markdown
# Oestriadam Live Timing

Phone-first live timing for the Oestriadam quarter-triathlon.

## Setup
1. Create a Supabase project; run `supabase/schema.sql` and the RLS policies (see Task 12 / spec).
2. Copy `.env.local.example` to `.env.local` and fill in Supabase URL, anon key, service-role key,
   and choose a `STATION_KEY` and `ADMIN_KEY`.
3. `npm install && npm run dev`.

## Screens
- `/` — public live leaderboard (open).
- `/station/t1`, `/station/t2`, `/station/finish` — volunteer timing (enter STATION_KEY once).
- `/admin` — set gun time, import roster CSV, manage participants, mark DNF/DNS (enter ADMIN_KEY).

## Race-day checklist
1. Admin: import roster CSV, confirm participant count.
2. Open each station screen on its phone, enter the station key.
3. At the gun: Admin → START RACE.
4. Volunteers record bibs at T1, T2, Finish.
5. After the race: mark any DNF/DNS; export results.

## Deploy (Vercel)
- Push to GitHub, import into Vercel, set the same env vars in the Vercel project settings.
- `npm run test` runs the unit + integration suite.

## CSV format
`bib,name,type,team_name,category,relay_swimmer,relay_cyclist,relay_runner`
```

- [ ] **Step 2: Final full verification**

Run: `npm run test && npx tsc --noEmit && npm run build`
Expected: tests PASS, type-check clean, production build succeeds.

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "docs: add README and race-day checklist"
```

---

## Deferred / fast-cut options (if the 5-day timeline tightens)

These are already designed to degrade gracefully — drop in this order:
1. **Realtime** (Task 12) → rely on the 10s polling already built (remove the Supabase channel subscription).
2. **CSV import** (Task 11) → use manual add only (the `add` action already exists).
3. **Results CSV export** (Task 16) → manual screenshot/announce works in a pinch.

Core that must ship: roster present, gun time, 3 stations recording, public leaderboard.
```

