# Oestriadam Live Timing Tool — Design

**Date:** 2026-06-15
**Event:** Oestriadam quarter-triathlon — 1 km swim / 42 km bike / 10 km run
**Event date:** 2026-06-20 (5 days out at time of writing)
**Status:** Approved design, ready for implementation planning

## 1. Purpose

A lightweight but polished live timing tool for a one-day triathlon. Volunteers
record split times at timing stations by tapping a button; spectators and athletes
follow a live public leaderboard on their phones; organizers manage the roster and
results from an admin screen.

Scope is deliberately small (single event, single day). No accounts system, no
hardware integration, no historical/multi-event support in v1.

## 2. Requirements (from brainstorming)

- **Timing input:** a volunteer at each station types the athlete's bib number and
  taps RECORD. No chips/hardware.
- **Timing points:** per-discipline splits via **three stations** — T1 (swim→bike),
  T2 (bike→run), Finish — plus a single gun-time start.
- **Start:** single mass start. One global gun time; no per-bib start taps.
- **Participants:** individuals and relay teams, with a flexible category field.
  Loaded via **CSV import and/or manual add/edit** in the admin screen.
- **Output:** a **public live leaderboard** during the race + final results with CSV
  export.
- **Connectivity:** reliable mobile/wifi at the venue → normal cloud backend.
- **Access control:** station and admin screens gated by a secret key in the URL;
  public leaderboard is open.

## 3. Architecture

**Approach A (chosen):** real-time push with automatic degradation to polling.

Single **Next.js (App Router)** app deployed on **Vercel**, backed by **Supabase
Postgres** (with Supabase Realtime for live updates).

Routes / surfaces:

- `/` — **public leaderboard** (open, read-only). Subscribes to Supabase Realtime;
  falls back to 10s polling if the socket drops.
- `/station/[point]?key=…` — **station app** for `point` ∈ {`t1`, `t2`, `finish`}.
  Big bib keypad + RECORD. Gated by station key.
- `/admin?key=…` — **admin**: set/clear gun time, CSV import, add/edit/delete
  participants, void/correct splits, mark DNF/DNS, export results.
- **Server (route handlers / server actions)** — validates keys, writes timestamps
  using the **server clock** (source of truth), exposes read APIs.

## 4. Data model (Postgres)

### `race` (single row)
- `id`
- `event_name` (text)
- `gun_time` (timestamptz, nullable until the race starts)

### `participants`
- `id`
- `bib` (int/text, unique)
- `name` (text)
- `type` (`individual` | `relay`)
- `team_name` (text, nullable)
- `category` (text, nullable — flexible/free-text, e.g. "M 30-39", "Dames", "Relay")
- `relay_swimmer`, `relay_cyclist`, `relay_runner` (text, nullable — names for relays)
- `status` (`active` | `dnf` | `dns`, default `active`)

### `splits`
- `id`
- `participant_id` (fk)
- `point` (`t1` | `t2` | `finish`)
- `recorded_at` (timestamptz, server time)
- `station_key_used` (text, audit)
- `voided` (bool, default false — corrections void rather than delete)

One *effective* row per participant per point (latest non-voided wins). Re-recording
voids the previous entry.

### Computed (not stored)
- swim split = `t1 − gun_time`
- bike split = `t2 − t1`
- run split = `finish − t2`
- total = `finish − gun_time`

Storing raw timestamps and computing on read means corrections never require
recalculating stored aggregates.

## 5. Timing flow & station UX

Each station screen (`/station/t1`, etc.):

1. Header shows the station name ("T1 — Swim → Bike") so the volunteer is never
   unsure where they are.
2. Volunteer types the **bib**; the matched **athlete name** appears as confirmation.
3. Big **RECORD** button captures the **server timestamp**; a toast confirms
   (`✅ #142 Jan de Vries — 00:32:14`) and the bib field clears.
4. A **"recent at this station"** list (last ~10) supports spotting/undoing mistakes.
   - **Undo** voids the last entry.
   - **Re-record** for the same bib supersedes the previous (voids old).

**Start:** a single **START RACE** button (admin) sets `gun_time` for everyone. No
per-bib start taps.

**Guardrails:**
- Unknown bib → warn but allow recording (admin reconciles later).
- Duplicate at same point → "Already recorded at HH:MM:SS — replace?" confirm.
- Out-of-order checkpoint (e.g. T2 before T1) → soft warning, still allowed.
- Gun time not yet set → stations warn that elapsed times are pending.

## 6. Public leaderboard & results

Phone-first `/`:

- Live ranking: finishers first (by total time), then in-progress athletes ordered by
  furthest checkpoint reached.
- Row: rank, bib, name (or team name), category, status (🏊/🚴/🏃/✅), elapsed/total
  time ticking live, and category rank.
- **Filter tabs:** All · Individuals · Relays · by category.
- **Tap a row** → detail with that athlete's swim/bike/run splits and category rank.
- Realtime push (badge flashes on new finishers); silent polling fallback.

**Final results:** finishing order after the race; **admin CSV export** (rank, bib,
name, category, splits, total) for printing/announcing/posting.

**DNF/DNS:** admin can mark a participant DNF/DNS so they drop out of rankings cleanly.
Athletes who simply miss a checkpoint remain "in progress" until marked.

## 7. Access control

- Station and admin screens validate a secret key (`?key=…`) **server-side** against
  env-configured values (`STATION_KEY`, `ADMIN_KEY`). Key is cached in the browser
  after first use so volunteers don't re-enter it.
- A single shared station key covers all stations in v1 (per-station keys are a
  trivial later extension).
- Public leaderboard requires no key.
- No accounts/password database — right-sized for a single-day event.

## 8. Error handling & edge cases

- **Server clock** is the single source of truth for all timestamps.
- **Idempotent recording:** safe to retry; re-record supersedes via `voided`, never
  deletes history.
- **CSV import:** validate headers, duplicate bibs, required fields; show a preview
  before committing.
- Handled cases: unknown bib (allow + flag), duplicate at point (confirm replace),
  out-of-order checkpoint (soft warn), gun time unset (warn, defer elapsed display).

## 9. Testing

- **Unit:** time/ranking computation (splits, ordering, DNF handling) — the core
  logic; CSV parser.
- **Integration:** record → leaderboard update flow.
- **Manual:** phone run-through of all three stations + leaderboard before race day.

## 10. Out of scope (v1 / YAGNI)

- Chip/RFID timing, offline-first sync, multi-event/history, per-station distinct
  keys, user accounts, podium/awards UI beyond category rank in rows, i18n beyond
  Dutch labels.
