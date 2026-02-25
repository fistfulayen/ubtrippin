-- PRD 009 — Collaborative Trips
-- Phase 1: trip_collaborators table + RLS updates

-- -----------------------------------------------------------------------
-- 1. trip_collaborators table
-- -----------------------------------------------------------------------
create table if not exists public.trip_collaborators (
  id            uuid        primary key default gen_random_uuid(),
  trip_id       uuid        not null references public.trips(id) on delete cascade,
  user_id       uuid        references auth.users(id) on delete cascade,        -- NULL until invite accepted
  role          text        not null check (role in ('owner', 'editor', 'viewer')),
  invited_email text        not null,
  invited_by    uuid        not null references auth.users(id) on delete cascade,
  invite_token  text        unique,                                               -- nanoid, null after accepted
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.trip_collaborators is
  'Collaborative access to trips — editors can add/edit items, viewers read-only.';

-- Indexes
create index if not exists idx_trip_collaborators_trip
  on public.trip_collaborators(trip_id);

create index if not exists idx_trip_collaborators_user
  on public.trip_collaborators(user_id)
  where user_id is not null;

create unique index if not exists idx_trip_collaborators_token
  on public.trip_collaborators(invite_token)
  where invite_token is not null;

create index if not exists idx_trip_collaborators_email
  on public.trip_collaborators(invited_email);

-- Auto-update updated_at
create or replace function public.touch_trip_collaborator()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trip_collaborators_updated_at
  before update on public.trip_collaborators
  for each row execute function public.touch_trip_collaborator();

-- -----------------------------------------------------------------------
-- 2. RLS on trip_collaborators
-- -----------------------------------------------------------------------
alter table public.trip_collaborators enable row level security;

-- Trip owner can see all collaborators on their trips
create policy "collab_owner_select" on public.trip_collaborators
  for select using (
    exists (
      select 1 from public.trips
      where id = trip_id and user_id = auth.uid()
    )
  );

-- Collaborators can see their own rows
create policy "collab_self_select" on public.trip_collaborators
  for select using (user_id = auth.uid());

-- Trip owner can invite (insert)
create policy "collab_owner_insert" on public.trip_collaborators
  for insert with check (
    exists (
      select 1 from public.trips
      where id = trip_id and user_id = auth.uid()
    )
  );

-- Trip owner can update collaborators on their trips (role changes, revoke)
create policy "collab_owner_update" on public.trip_collaborators
  for update using (
    exists (
      select 1 from public.trips
      where id = trip_id and user_id = auth.uid()
    )
  );

-- Collaborator can update their own row (accepting the invite)
create policy "collab_self_accept" on public.trip_collaborators
  for update using (
    invited_email = (
      select email from public.profiles where id = auth.uid()
    )
  );

-- Trip owner can delete collaborators
create policy "collab_owner_delete" on public.trip_collaborators
  for delete using (
    exists (
      select 1 from public.trips
      where id = trip_id and user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------
-- 3. Update trips RLS — collaborators can read trips they're invited to
-- -----------------------------------------------------------------------

-- Drop existing select policy if any, then recreate including collaborators
-- (The trip table likely uses Supabase default auth via anon/service role;
-- we update it to also allow accepted collaborators.)
drop policy if exists "Users can view own trips" on public.trips;
drop policy if exists "trips_collaborators_select" on public.trips;

create policy "trips_collaborators_select" on public.trips
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_collaborators
      where trip_id = trips.id
        and user_id = auth.uid()
        and accepted_at is not null
    )
  );

-- -----------------------------------------------------------------------
-- 4. Update trip_items RLS — editors/owners can insert and update
-- -----------------------------------------------------------------------
drop policy if exists "trip_items_collab_insert" on public.trip_items;
drop policy if exists "trip_items_collab_update" on public.trip_items;

create policy "trip_items_collab_insert" on public.trip_items
  for insert with check (
    -- Owner
    exists (select 1 from public.trips where id = trip_id and user_id = auth.uid())
    or
    -- Editor collaborator
    exists (
      select 1 from public.trip_collaborators
      where trip_id = trip_items.trip_id
        and user_id = auth.uid()
        and role = 'editor'
        and accepted_at is not null
    )
  );

create policy "trip_items_collab_update" on public.trip_items
  for update using (
    exists (select 1 from public.trips where id = trip_id and user_id = auth.uid())
    or
    exists (
      select 1 from public.trip_collaborators
      where trip_id = trip_items.trip_id
        and user_id = auth.uid()
        and role = 'editor'
        and accepted_at is not null
    )
  );

-- Viewers (and editors/owners) can select trip_items
drop policy if exists "trip_items_collab_select" on public.trip_items;

create policy "trip_items_collab_select" on public.trip_items
  for select using (
    exists (select 1 from public.trips where id = trip_id and user_id = auth.uid())
    or
    exists (
      select 1 from public.trip_collaborators
      where trip_id = trip_items.trip_id
        and user_id = auth.uid()
        and accepted_at is not null
    )
  );
