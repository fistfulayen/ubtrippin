-- Allow shared-trip editors/family members to update trip metadata.
-- Keep ownership immutable during these updates.

CREATE OR REPLACE FUNCTION public.trip_owner_user_id(p_trip_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT user_id
  FROM public.trips
  WHERE id = p_trip_id
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "trips_collaborators_update" ON public.trips;
CREATE POLICY "trips_collaborators_update" ON public.trips
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trips.id
        AND tc.user_id = auth.uid()
        AND tc.role = 'editor'
        AND tc.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trips.id
        AND tc.user_id = auth.uid()
        AND tc.role = 'editor'
        AND tc.accepted_at IS NOT NULL
    )
    AND user_id = public.trip_owner_user_id(id)
  );

DROP POLICY IF EXISTS "trips_family_update" ON public.trips;
CREATE POLICY "trips_family_update" ON public.trips
  FOR UPDATE
  USING (public.is_family_member(user_id))
  WITH CHECK (
    public.is_family_member(user_id)
    AND user_id = public.trip_owner_user_id(id)
  );
