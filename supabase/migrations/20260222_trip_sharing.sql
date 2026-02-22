-- Trip Sharing Migration
-- Adds share_token and share_enabled columns to the trips table

alter table public.trips
  add column if not exists share_token text unique,
  add column if not exists share_enabled boolean not null default false;

-- Index for fast share_token lookups (used by the public share page)
create index if not exists idx_trips_share_token
  on public.trips(share_token)
  where share_token is not null;
