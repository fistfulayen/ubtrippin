-- Add DELETE policy for trip_items
-- Allows: item owner, trip owner, accepted collaborators (editors), family members
CREATE POLICY "trip_items_delete" ON public.trip_items
  FOR DELETE USING (
    -- You own the item
    user_id = auth.uid()
    -- OR you own the trip
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND t.user_id = auth.uid()
    )
    -- OR you're an accepted collaborator (editor) on the trip
    OR EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_items.trip_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
    -- OR you're a family member of the trip owner
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND public.is_family_member(t.user_id)
    )
  );
