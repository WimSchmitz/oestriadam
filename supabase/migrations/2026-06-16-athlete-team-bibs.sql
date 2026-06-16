-- Migration: athlete/team bibs overlap + gender + athlete_names.
-- Run this in the Supabase SQL editor against an existing deployment.
-- (A fresh project should just run schema.sql, which already includes all of this.)

-- 1. Bib is unique per type, not globally — athlete #1 and team #1 may both exist.
alter table participants drop constraint if exists participants_bib_key;
alter table participants add constraint participants_type_bib_key unique (type, bib);

-- 2. New columns to match the real roster shape.
alter table participants add column if not exists gender text;        -- individuals: 'M' | 'V'
alter table participants add column if not exists athlete_names text;  -- teams: free-text athletes

-- 3. Drop the old fixed relay roles (replaced by athlete_names).
alter table participants drop column if exists relay_swimmer;
alter table participants drop column if exists relay_cyclist;
alter table participants drop column if exists relay_runner;
