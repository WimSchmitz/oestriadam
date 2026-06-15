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

-- Public read-only access for the leaderboard (writes go through the service-role
-- key in API routes, which bypasses RLS).
alter table race enable row level security;
alter table participants enable row level security;
alter table splits enable row level security;
create policy "public read race" on race for select using (true);
create policy "public read participants" on participants for select using (true);
create policy "public read splits" on splits for select using (true);
