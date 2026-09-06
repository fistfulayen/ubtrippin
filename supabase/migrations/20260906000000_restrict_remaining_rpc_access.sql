-- Extraction example counters are ingestion-only, not a public mutation API.
REVOKE ALL ON FUNCTION public.increment_example_usage(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_example_usage(uuid[]) TO service_role;

-- Preserve the ownership-immutability helper for every user who can read the
-- trip, without allowing unrelated callers to resolve arbitrary trip owners.
CREATE OR REPLACE FUNCTION public.trip_owner_user_id(p_trip_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.user_id FROM public.trips t
  WHERE t.id = p_trip_id
    AND (
      auth.role() = 'service_role'
      OR t.user_id = auth.uid()
      OR public.is_family_member(t.user_id)
      OR EXISTS (
        SELECT 1 FROM public.trip_collaborators tc
        WHERE tc.trip_id = t.id AND tc.user_id = auth.uid()
          AND tc.accepted_at IS NOT NULL
      )
    )
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.trip_owner_user_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_owner_user_id(uuid) TO authenticated, service_role;
