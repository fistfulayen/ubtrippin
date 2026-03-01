-- Fix: Trip owners should see ALL items on their trips, not just their own.
-- After a merge, items may have a different user_id than the trip owner.
-- Also: trip owners should see items added by collaborators.

DROP POLICY IF EXISTS "trip_items_select" ON public.trip_items;

CREATE POLICY "trip_items_select" ON public.trip_items
  FOR SELECT USING (
    -- You own the item
    user_id = auth.uid()
    -- OR you own the trip
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND t.user_id = auth.uid()
    )
    -- OR you're an accepted collaborator on the trip
    OR EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_items.trip_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
  );
