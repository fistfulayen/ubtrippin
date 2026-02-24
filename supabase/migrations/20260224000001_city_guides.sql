-- City Guides: personal place collections with public sharing
-- PRD 006

-- Enable earthdistance for geo-proximity queries (requires cube first)
create extension if not exists cube;
create extension if not exists earthdistance;

-- -----------------------------------------------------------------------
-- city_guides
-- -----------------------------------------------------------------------
create table public.city_guides (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  city            text not null,
  country         text,
  country_code    text,          -- ISO 3166-1 alpha-2 (e.g. "FR")
  is_public       boolean not null default false,
  share_token     text unique,   -- nanoid, null until first share
  cover_image_url text,
  entry_count     int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_city_guides_user on public.city_guides(user_id);
create index idx_city_guides_token on public.city_guides(share_token) where share_token is not null;

-- -----------------------------------------------------------------------
-- guide_entries
-- -----------------------------------------------------------------------
create table public.guide_entries (
  id                       uuid primary key default gen_random_uuid(),
  guide_id                 uuid not null references public.city_guides(id) on delete cascade,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  name                     text not null,
  category                 text not null default 'Hidden Gems',
  status                   text not null default 'visited' check (status in ('visited', 'to_try')),
  description              text,
  address                  text,
  latitude                 double precision,
  longitude                double precision,
  google_place_id          text,
  website_url              text,
  rating                   int check (rating >= 1 and rating <= 5),
  recommended_by           text,
  recommended_by_user_id   uuid references auth.users(id) on delete set null,
  tags                     text[] default '{}',
  source                   text not null default 'manual' check (source in ('manual', 'agent', 'import', 'share-to')),
  source_url               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_guide_entries_guide on public.guide_entries(guide_id);
create index idx_guide_entries_user on public.guide_entries(user_id);
-- Geo index for proximity queries (only rows with coordinates)
create index idx_guide_entries_geo on public.guide_entries
  using gist (ll_to_earth(latitude, longitude))
  where latitude is not null and longitude is not null;

-- -----------------------------------------------------------------------
-- entry_count trigger
-- -----------------------------------------------------------------------
create or replace function public.update_guide_entry_count()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.city_guides set entry_count = entry_count + 1, updated_at = now()
      where id = new.guide_id;
  elsif (tg_op = 'DELETE') then
    update public.city_guides set entry_count = greatest(entry_count - 1, 0), updated_at = now()
      where id = old.guide_id;
  end if;
  return null;
end;
$$;

create trigger trg_guide_entry_count
after insert or delete on public.guide_entries
for each row execute function public.update_guide_entry_count();

-- -----------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- (function may already exist from other tables — if not, it's now created)
create trigger trg_city_guides_updated_at
before update on public.city_guides
for each row execute function public.set_updated_at();

create trigger trg_guide_entries_updated_at
before update on public.guide_entries
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------
-- Nearby RPC (used by GET /api/v1/guides/nearby)
-- -----------------------------------------------------------------------
create or replace function public.guides_nearby(
  p_user_id  uuid,
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m double precision default 5000
)
returns table (
  id                     uuid,
  guide_id               uuid,
  user_id                uuid,
  name                   text,
  category               text,
  status                 text,
  description            text,
  address                text,
  latitude               double precision,
  longitude              double precision,
  website_url            text,
  rating                 int,
  recommended_by         text,
  tags                   text[],
  source                 text,
  source_url             text,
  created_at             timestamptz,
  city                   text,
  country                text,
  distance_m             double precision
)
language sql stable security definer as $$
  select
    ge.id,
    ge.guide_id,
    ge.user_id,
    ge.name,
    ge.category,
    ge.status,
    ge.description,
    ge.address,
    ge.latitude,
    ge.longitude,
    ge.website_url,
    ge.rating,
    ge.recommended_by,
    ge.tags,
    ge.source,
    ge.source_url,
    ge.created_at,
    cg.city,
    cg.country,
    earth_distance(
      ll_to_earth(p_lat, p_lng),
      ll_to_earth(ge.latitude, ge.longitude)
    ) as distance_m
  from public.guide_entries ge
  join public.city_guides cg on cg.id = ge.guide_id
  where ge.user_id = p_user_id
    and ge.latitude is not null
    and ge.longitude is not null
    and earth_distance(
          ll_to_earth(p_lat, p_lng),
          ll_to_earth(ge.latitude, ge.longitude)
        ) <= p_radius_m
  order by distance_m asc;
$$;

-- -----------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------
alter table public.city_guides enable row level security;
alter table public.guide_entries enable row level security;

-- city_guides: owner can do everything
create policy "guides_owner_all" on public.city_guides
  for all using (auth.uid() = user_id);

-- city_guides: anyone can read public guides via share_token (service role bypasses RLS anyway)
create policy "guides_public_read" on public.city_guides
  for select using (is_public = true);

-- guide_entries: owner can do everything
create policy "entries_owner_all" on public.guide_entries
  for all using (auth.uid() = user_id);

-- guide_entries: public guide entries readable by anyone
create policy "entries_public_read" on public.guide_entries
  for select using (
    exists (
      select 1 from public.city_guides
      where id = guide_entries.guide_id and is_public = true
    )
  );
