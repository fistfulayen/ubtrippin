-- HOTFIX: Nuclear RLS fix — drop ALL select policies on trips and trip_items,
-- then recreate clean ones. We can't determine the old policy names.

-- First, ensure RLS is enabled (it should be already)
alter table public.trips enable row level security;
alter table public.trip_items enable row level security;

-- Use DO block to drop all SELECT policies on trips
DO $$
DECLARE
  pol record;
BEGIN
  -- Drop all SELECT policies on trips
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'trips' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.trips', pol.policyname);
    RAISE NOTICE 'Dropped trips SELECT policy: %', pol.policyname;
  END LOOP;
  
  -- Drop all SELECT policies on trip_items
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'trip_items' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.trip_items', pol.policyname);
    RAISE NOTICE 'Dropped trip_items SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

-- Recreate clean SELECT policies
-- Trips: owner OR accepted collaborator
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

-- Trip items: owner OR accepted collaborator
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
