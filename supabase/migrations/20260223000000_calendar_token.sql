-- Calendar Feed Token Migration
-- Adds a per-user token for unauthenticated iCal feed access

alter table public.profiles
  add column if not exists calendar_token text unique;

create index if not exists idx_profiles_calendar_token
  on public.profiles(calendar_token)
  where calendar_token is not null;
