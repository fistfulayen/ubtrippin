-- HOTFIX: Restore trips SELECT policy
-- The collaborative trips migration tried to drop "Users can view own trips"
-- but the actual policy name was different, so the drop was a no-op.
-- Meanwhile the new policy may not be working correctly.
-- This ensures a simple, working SELECT policy exists.

-- Drop any potentially broken policies and recreate clean
drop policy if exists "trips_collaborators_select" on public.trips;
drop policy if exists "Users can view own trips" on public.trips;
drop policy if exists "Enable read access for users" on public.trips;
drop policy if exists "Users can select own trips" on public.trips;
drop policy if exists "trips_select_policy" on public.trips;
drop policy if exists "Authenticated users can read own trips" on public.trips;

-- Recreate: owner OR accepted collaborator can read
create policy "trips_select" on public.trips
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_collaborators
      where trip_id = trips.id
        and user_id = auth.uid()
        and accepted_at is not null
    )
  );

-- Also ensure trip_items SELECT works
drop policy if exists "trip_items_collab_select" on public.trip_items;
drop policy if exists "Users can view own trip items" on public.trip_items;
drop policy if exists "Enable read access for users" on public.trip_items;
drop policy if exists "Users can select own trip_items" on public.trip_items;

create policy "trip_items_select" on public.trip_items
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_collaborators
      where trip_id = trip_items.trip_id
        and user_id = auth.uid()
        and accepted_at is not null
    )
  );
