-- Fix infinite recursion: trips_select → trip_collaborators → collab_owner_select → trips → ...
--
-- The collab_owner_select policy on trip_collaborators does
--   EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND user_id = auth.uid())
-- which triggers the trips SELECT policies, which check trip_collaborators, etc.
--
-- Fix: Replace collab_owner_select with a SECURITY DEFINER function that
-- reads trips.user_id without triggering RLS.

-- 1. Create a helper function that checks trip ownership without RLS
CREATE OR REPLACE FUNCTION public.is_trip_owner(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = p_trip_id AND user_id = auth.uid()
  );
$$;

-- 2. Replace the recursive policies on trip_collaborators
DROP POLICY IF EXISTS "collab_owner_select" ON public.trip_collaborators;
CREATE POLICY "collab_owner_select" ON public.trip_collaborators
  FOR SELECT USING (
    public.is_trip_owner(trip_id)
  );

DROP POLICY IF EXISTS "collab_owner_insert" ON public.trip_collaborators;
CREATE POLICY "collab_owner_insert" ON public.trip_collaborators
  FOR INSERT WITH CHECK (
    public.is_trip_owner(trip_id)
  );

DROP POLICY IF EXISTS "collab_owner_update" ON public.trip_collaborators;
CREATE POLICY "collab_owner_update" ON public.trip_collaborators
  FOR UPDATE USING (
    public.is_trip_owner(trip_id)
  );

DROP POLICY IF EXISTS "collab_owner_delete" ON public.trip_collaborators;
CREATE POLICY "collab_owner_delete" ON public.trip_collaborators
  FOR DELETE USING (
    public.is_trip_owner(trip_id)
  );

-- 3. Also fix trip_items policies that reference trips (same recursion risk)
-- trip_items_select checks trips via collaborators, but trips checks trip_collaborators
-- The original "Users can manage own trip items" (FOR ALL, user_id = auth.uid())
-- doesn't recurse. Only the collab policies do.

-- trip_items_collab_update references trips — use the helper function
DROP POLICY IF EXISTS "trip_items_collab_update" ON public.trip_items;
CREATE POLICY "trip_items_collab_update" ON public.trip_items
  FOR UPDATE USING (
    public.is_trip_owner(trip_id)
    OR EXISTS (
      SELECT 1 FROM public.trip_collaborators
      WHERE trip_id = trip_items.trip_id
        AND user_id = auth.uid()
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  );

-- trip_items_collab_insert references trips — use the helper function
DROP POLICY IF EXISTS "trip_items_collab_insert" ON public.trip_items;
CREATE POLICY "trip_items_collab_insert" ON public.trip_items
  FOR INSERT WITH CHECK (
    public.is_trip_owner(trip_id)
    OR EXISTS (
      SELECT 1 FROM public.trip_collaborators
      WHERE trip_id = trip_items.trip_id
        AND user_id = auth.uid()
        AND role = 'editor'
        AND accepted_at IS NOT NULL
    )
  );

-- 4. Also fix the nuclear-fix trips_select policy (same pattern)
DROP POLICY IF EXISTS "trips_select" ON public.trips;
DROP POLICY IF EXISTS "trips_collaborators_select" ON public.trips;
CREATE POLICY "trips_select" ON public.trips
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = trips.id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
  );
-- This is safe because trip_collaborators SELECT policies now use
-- is_trip_owner() (SECURITY DEFINER) instead of querying trips directly.

-- 5. Same for trip_items_select
DROP POLICY IF EXISTS "trip_items_select" ON public.trip_items;
CREATE POLICY "trip_items_select" ON public.trip_items
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_items.trip_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
  );
