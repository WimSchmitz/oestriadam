# Athlete/Team bibs, persistent nav, and needs-check warnings

**Date:** 2026-06-16
**Status:** Approved (design)

## Background

End-user feedback on the live-timing app, in priority order:

1. **Participant data is the priority.** Individuals are `Nr + Naam + Geslacht`; teams are
   `Nr + names of the athletes`. The two number lists are **separate and overlap** — both start
   from 1, so athlete #1 and team #1 both exist. The organizer cannot renumber. They asked for
   **separate athlete/team buttons** when entering a bib at a station.
2. The organizer footer nav (`Organizers: T1 · T2 · Finish · Admin`) should appear on **every page**.
3. When an **illogical recording** is made (same bib recorded again at one checkpoint, or a later
   checkpoint recorded before an earlier one for the same competitor), it should show in **yellow**
   so the operator knows to re-check it.

## Root cause

`participants.bib` is declared `integer not null unique`, with CSV upsert `onConflict: "bib"` and a
bib-only lookup `getParticipantByBib(bib)`. A globally-unique bib cannot represent overlapping
athlete/team numbering. This is a schema + data-flow change, not only a UI change.

Splits reference the participant **UUID**, not the bib, so recording/undo logic is unaffected by the
bib change.

## Design

### 1. Data model & schema

`participants` table:
- Remove global `unique(bib)`; add **`unique(type, bib)`** — each list owns its own 1…N numbering.
- Add **`gender text`** — for individuals (`'M'` | `'V'`); null for teams.
- Drop `relay_swimmer`, `relay_cyclist`, `relay_runner`; add **`athlete_names text`** — free-text
  list of a team's athletes.
- Keep `category text` as an optional column (no longer the ranking key — see §6).

Deliver migration SQL and update `supabase/schema.sql`. `Participant` type: add `gender` and
`athleteNames`; remove `relaySwimmer/relayCyclist/relayRunner`.

### 2. CSV import

- Header: `bib,name,type,gender,athlete_names,category`. Required stays `bib,name,type`.
- Individuals supply `gender`; relays supply `athlete_names`.
- Dedup per `(type, bib)` instead of global `bib`.
- `upsertParticipants` uses `onConflict: "type,bib"`.

### 3. Station entry — Athlete/Team toggle

- A segmented **Athlete / Team** control above the bib field. Default **Athlete**; remembered
  per device (localStorage).
- The single big **RECORD** button and **Enter-to-record** behavior stay unchanged — they record
  using the current toggle value.
- POST body becomes `{ action: "record", bib, point, type }`.
- Lookup becomes type-aware: `getParticipantByBibAndType(bib, type)`. Unknown-bib handling unchanged.

### 4. Needs-check (yellow) warnings

Computed **server-side from existing splits — no new columns.** Recording still succeeds
(non-blocking); the warning is advisory.

Two flags:
- **`duplicate`** — a non-voided split already exists for this participant at this checkpoint
  (i.e. re-recording supersedes the prior one). Message: "recorded again — check".
- **`out_of_order`** — recording a checkpoint while an earlier one is missing (T2 before T1;
  Finish before T1 or T2).

Surfacing:
- The record API returns a `warnings: string[]` field; the station shows a **yellow toast** when
  non-empty.
- `GET /api/splits` annotates each recent split with the same flags, so the affected row in
  **"Recent at this station"** renders **yellow with ⚠️** and the warning persists past the toast.

### 5. Organizer nav on every page

Extract the footer nav into a shared **`<OrganizerNav current?>`** component and render it from the
root layout, so it appears on the leaderboard, all station pages, and admin. The current page is
highlighted (and rendered as plain text, not a link).

### 6. Ranking by gender + display follow-through

- **Category rank** now groups by `gender` for individuals and treats relay teams as their own
  group, replacing the old `category`-based grouping in `leaderboard.ts`.
- Leaderboard row-expand and the admin participant list show **gender** (individuals) /
  **athlete names** (teams).
- `results-csv.ts` replaces the old relay-role/category-only columns with **gender** and
  **athlete_names** where appropriate; ranking columns reflect the gender grouping.

## Out of scope

- Surfacing the yellow warnings to the admin screen (warnings are station-side only for now).
- Any change to splits storage, undo, or Realtime wiring.

## Testing

- Unit: `csv.ts` (new header, per-`(type,bib)` dedup), `leaderboard.ts` (gender grouping),
  `results-csv.ts` (new columns), and the warning computation (duplicate + out-of-order).
- `npx tsc --noEmit` and `npm run build` clean.
