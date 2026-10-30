-- Public share pages authorize the token and sanitize data server-side.
-- Raw table policies bypass that redaction and expose booking capabilities.
-- Owner/collaborator/family policies and all stored rows remain intact.
DROP POLICY IF EXISTS trips_public_share_select ON public.trips;
DROP POLICY IF EXISTS trip_items_public_share_select ON public.trip_items;

-- An entry's caller-owned user_id is insufficient: the parent guide must also
-- belong to that caller. This covers direct PostgREST writes, not only the API.
DROP POLICY IF EXISTS guide_entries_insert ON public.guide_entries;
CREATE POLICY guide_entries_insert ON public.guide_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.city_guides cg
      WHERE cg.id = guide_entries.guide_id AND cg.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS guide_entries_update ON public.guide_entries;
CREATE POLICY guide_entries_update ON public.guide_entries
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.city_guides cg
      WHERE cg.id = guide_entries.guide_id AND cg.user_id = (SELECT auth.uid())
    )
  );
