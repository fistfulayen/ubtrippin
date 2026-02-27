-- PRD 016 Phase 1 — Flight status

create table if not exists public.trip_item_status (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.trip_items(id) on delete cascade,
  status text not null default 'unknown'
    check (status in ('on_time', 'delayed', 'cancelled', 'diverted', 'en_route', 'boarding', 'landed', 'arrived', 'unknown')),
  delay_minutes integer,
  gate text,
  terminal text,
  platform text,
  estimated_departure timestamptz,
  estimated_arrival timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  raw_response jsonb,
  source text not null default 'flightaware',
  last_checked_at timestamptz default now(),
  status_changed_at timestamptz,
  previous_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(item_id)
);

create index if not exists idx_trip_item_status_item on public.trip_item_status(item_id);
create index if not exists idx_trip_item_status_checked on public.trip_item_status(last_checked_at);

alter table public.trip_item_status enable row level security;

drop policy if exists "status_select_owner" on public.trip_item_status;
create policy "status_select_owner" on public.trip_item_status
  for select using (
    exists (
      select 1
      from public.trip_items ti
      where ti.id = trip_item_status.item_id
        and public.is_trip_owner(ti.trip_id)
    )
  );

drop policy if exists "status_select_collaborator" on public.trip_item_status;
create policy "status_select_collaborator" on public.trip_item_status
  for select using (
    exists (
      select 1
      from public.trip_items ti
      join public.trip_collaborators tc on tc.trip_id = ti.trip_id
      where ti.id = trip_item_status.item_id
        and tc.user_id = auth.uid()
        and tc.accepted_at is not null
    )
  );

drop policy if exists "status_select_family" on public.trip_item_status;
create policy "status_select_family" on public.trip_item_status
  for select using (
    exists (
      select 1
      from public.trip_items ti
      join public.trips t on t.id = ti.trip_id
      where ti.id = trip_item_status.item_id
        and public.is_family_member(t.user_id)
    )
  );

drop policy if exists "status_insert_access" on public.trip_item_status;
create policy "status_insert_access" on public.trip_item_status
  for insert with check (
    exists (
      select 1
      from public.trip_items ti
      join public.trips t on t.id = ti.trip_id
      where ti.id = trip_item_status.item_id
        and (
          public.is_trip_owner(ti.trip_id)
          or exists (
            select 1
            from public.trip_collaborators tc
            where tc.trip_id = ti.trip_id
              and tc.user_id = auth.uid()
              and tc.accepted_at is not null
          )
          or public.is_family_member(t.user_id)
        )
    )
  );

drop policy if exists "status_update_access" on public.trip_item_status;
create policy "status_update_access" on public.trip_item_status
  for update using (
    exists (
      select 1
      from public.trip_items ti
      join public.trips t on t.id = ti.trip_id
      where ti.id = trip_item_status.item_id
        and (
          public.is_trip_owner(ti.trip_id)
          or exists (
            select 1
            from public.trip_collaborators tc
            where tc.trip_id = ti.trip_id
              and tc.user_id = auth.uid()
              and tc.accepted_at is not null
          )
          or public.is_family_member(t.user_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.trip_items ti
      join public.trips t on t.id = ti.trip_id
      where ti.id = trip_item_status.item_id
        and (
          public.is_trip_owner(ti.trip_id)
          or exists (
            select 1
            from public.trip_collaborators tc
            where tc.trip_id = ti.trip_id
              and tc.user_id = auth.uid()
              and tc.accepted_at is not null
          )
          or public.is_family_member(t.user_id)
        )
    )
  );

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at' and pg_function_is_visible(oid)) then
    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_trip_item_status_updated_at'
        and tgrelid = 'public.trip_item_status'::regclass
    ) then
      create trigger trg_trip_item_status_updated_at
      before update on public.trip_item_status
      for each row execute function public.set_updated_at();
    end if;
  elsif exists (select 1 from pg_proc where proname = 'update_updated_at_column' and pg_function_is_visible(oid)) then
    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_trip_item_status_updated_at'
        and tgrelid = 'public.trip_item_status'::regclass
    ) then
      create trigger trg_trip_item_status_updated_at
      before update on public.trip_item_status
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;

create table if not exists public.trip_item_status_refresh_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.trip_items(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_item_status_refresh_logs_user_created
  on public.trip_item_status_refresh_logs(user_id, created_at desc);

alter table public.trip_item_status_refresh_logs enable row level security;

drop policy if exists "status_refresh_logs_select_own" on public.trip_item_status_refresh_logs;
create policy "status_refresh_logs_select_own" on public.trip_item_status_refresh_logs
  for select using (user_id = auth.uid());

drop policy if exists "status_refresh_logs_insert_own" on public.trip_item_status_refresh_logs;
create policy "status_refresh_logs_insert_own" on public.trip_item_status_refresh_logs
  for insert with check (user_id = auth.uid());
