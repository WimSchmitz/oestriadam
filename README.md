# Oestriadam Live Timing

Phone-first live timing for the **Oestriadam** quarter-triathlon (1 km swim · 42 km bike · 10 km run).

Volunteers record split times at three stations; spectators follow a live public leaderboard; organizers manage the roster and results from an admin screen.

## Stack

Next.js (App Router, TypeScript) · Supabase (Postgres + Realtime) · Tailwind CSS · Vitest.

## Setup

1. **Create a Supabase project**, open the SQL Editor, and run [`supabase/schema.sql`](supabase/schema.sql). It creates the tables, seeds the single race row, enables Realtime, and adds public read-only RLS policies.
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Project Settings → API)
   - `STATION_KEY` and `ADMIN_KEY` — pick your own secrets; share the station key with volunteers on the day.
3. `npm install && npm run dev`, then open http://localhost:3000.

## Screens

- `/` — **public live leaderboard** (open to all). Tap a row for swim/bike/run splits.
- `/station/t1`, `/station/t2`, `/station/finish` — **volunteer timing** (enter the `STATION_KEY` once; it's remembered on the device).
- `/admin` — set the gun time, import the roster CSV, manage participants, mark DNF/DNS, export results (enter the `ADMIN_KEY`).

## Race-day checklist

1. **Admin** → Import roster CSV, confirm the participant count.
2. Open each station screen on its phone, enter the station key.
3. At the gun: **Admin → START RACE**.
4. Volunteers record bibs at **T1**, **T2**, **Finish** (type bib → RECORD; undo via the recent list).
5. After the race: mark any **DNF/DNS**, then **Export CSV** for announcing/posting.

## CSV format

```
bib,name,type,gender,athlete_names,category
1,Jan de Vries,individual,M,,M 30-39
1,Team Zeester,relay,,Ann / Bob / Cara,Relay
```

`type` is `individual` or `relay`. Only `bib`, `name`, `type` are required; the rest are optional. For individuals, set `gender` (`M`/`V`); for relay teams, list the members in `athlete_names` (avoid commas — they split CSV cells; use `/` or spaces).

**Athlete and team numbers are separate lists and may overlap** — athlete #1 and team #1 can both exist. A bib is unique only within its type, so re-importing the same `(type, bib)` updates that participant. At a station, the operator picks **Athlete** or **Team** before recording.

## Deploy (Vercel)

Push to GitHub, import the repo into Vercel, and set the same five env vars in the Vercel project settings. Reliable mobile/wifi at the venue is assumed; the leaderboard pushes live via Supabase Realtime and falls back to 10-second polling if the socket drops.

## Tests

```
npm run test       # unit + integration (pure logic: time, progress, ranking, csv, results)
npx tsc --noEmit   # type-check
npm run build      # production build
```
