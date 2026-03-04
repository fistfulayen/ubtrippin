-- PRD-033 P2B: Consolidate overlapping permissive RLS policies.

-- trips
DROP POLICY IF EXISTS "Users can manage own trips" ON public.trips;
DROP POLICY IF EXISTS "trips_select" ON public.trips;
DROP POLICY IF EXISTS "trips_family_read" ON public.trips;
DROP POLICY IF EXISTS "trips_collaborators_update" ON public.trips;
DROP POLICY IF EXISTS "trips_family_update" ON public.trips;

CREATE POLICY "trips_select" ON public.trips
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trips.id
        AND tc.user_id = (SELECT auth.uid())
        AND tc.accepted_at IS NOT NULL
    )
    OR public.is_family_member(user_id)
  );

CREATE POLICY "trips_insert" ON public.trips
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

CREATE POLICY "trips_update" ON public.trips
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trips.id
        AND tc.user_id = (SELECT auth.uid())
        AND tc.role = 'editor'
        AND tc.accepted_at IS NOT NULL
    )
    OR public.is_family_member(user_id)
  )
  WITH CHECK (
    user_id = public.trip_owner_user_id(id)
    AND (
      user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.trip_collaborators tc
        WHERE tc.trip_id = trips.id
          AND tc.user_id = (SELECT auth.uid())
          AND tc.role = 'editor'
          AND tc.accepted_at IS NOT NULL
      )
      OR public.is_family_member(user_id)
    )
  );

CREATE POLICY "trips_delete" ON public.trips
  FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
  );

-- trip_items
DROP POLICY IF EXISTS "Users can manage own trip items" ON public.trip_items;
DROP POLICY IF EXISTS "trip_items_select" ON public.trip_items;
DROP POLICY IF EXISTS "trip_items_collab_insert" ON public.trip_items;
DROP POLICY IF EXISTS "trip_items_collab_update" ON public.trip_items;
DROP POLICY IF EXISTS "trip_items_family_read" ON public.trip_items;
DROP POLICY IF EXISTS "trip_items_family_insert" ON public.trip_items;
DROP POLICY IF EXISTS "trip_items_family_update" ON public.trip_items;

CREATE POLICY "trip_items_select" ON public.trip_items
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND t.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_items.trip_id
        AND tc.user_id = (SELECT auth.uid())
        AND tc.accepted_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND public.is_family_member(t.user_id)
    )
  );

CREATE POLICY "trip_items_insert" ON public.trip_items
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.is_trip_owner(trip_id)
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_items.trip_id
        AND tc.user_id = (SELECT auth.uid())
        AND tc.role = 'editor'
        AND tc.accepted_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND public.is_family_member(t.user_id)
    )
  );

CREATE POLICY "trip_items_update" ON public.trip_items
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_trip_owner(trip_id)
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_items.trip_id
        AND tc.user_id = (SELECT auth.uid())
        AND tc.role = 'editor'
        AND tc.accepted_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND public.is_family_member(t.user_id)
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.is_trip_owner(trip_id)
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_items.trip_id
        AND tc.user_id = (SELECT auth.uid())
        AND tc.role = 'editor'
        AND tc.accepted_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND public.is_family_member(t.user_id)
    )
  );

-- Keep dedicated delete policy added in PRD-030.

-- trip_collaborators
DROP POLICY IF EXISTS "collab_owner_select" ON public.trip_collaborators;
DROP POLICY IF EXISTS "collab_self_select" ON public.trip_collaborators;
DROP POLICY IF EXISTS "collab_owner_insert" ON public.trip_collaborators;
DROP POLICY IF EXISTS "collab_owner_update" ON public.trip_collaborators;
DROP POLICY IF EXISTS "collab_self_accept" ON public.trip_collaborators;
DROP POLICY IF EXISTS "collab_owner_delete" ON public.trip_collaborators;

CREATE POLICY "trip_collaborators_select" ON public.trip_collaborators
  FOR SELECT
  USING (
    public.is_trip_owner(trip_id)
    OR user_id = (SELECT auth.uid())
  );

CREATE POLICY "trip_collaborators_insert" ON public.trip_collaborators
  FOR INSERT
  WITH CHECK (
    public.is_trip_owner(trip_id)
  );

CREATE POLICY "trip_collaborators_update" ON public.trip_collaborators
  FOR UPDATE
  USING (
    public.is_trip_owner(trip_id)
    OR invited_email = (
      SELECT email
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "trip_collaborators_delete" ON public.trip_collaborators
  FOR DELETE
  USING (
    public.is_trip_owner(trip_id)
  );

-- trip_item_status
DROP POLICY IF EXISTS "status_select_owner" ON public.trip_item_status;
DROP POLICY IF EXISTS "status_select_collaborator" ON public.trip_item_status;
DROP POLICY IF EXISTS "status_select_family" ON public.trip_item_status;

CREATE POLICY "status_select" ON public.trip_item_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.trip_items ti
      JOIN public.trips t ON t.id = ti.trip_id
      WHERE ti.id = trip_item_status.item_id
        AND (
          public.is_trip_owner(ti.trip_id)
          OR EXISTS (
            SELECT 1
            FROM public.trip_collaborators tc
            WHERE tc.trip_id = ti.trip_id
              AND tc.user_id = (SELECT auth.uid())
              AND tc.accepted_at IS NOT NULL
          )
          OR public.is_family_member(t.user_id)
        )
    )
  );

-- city_guides
DROP POLICY IF EXISTS "guides_owner_all" ON public.city_guides;
DROP POLICY IF EXISTS "guides_public_read" ON public.city_guides;
DROP POLICY IF EXISTS "guides_family_read" ON public.city_guides;

CREATE POLICY "guides_select" ON public.city_guides
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR is_public = true
    OR public.is_family_member(user_id)
  );

CREATE POLICY "guides_insert" ON public.city_guides
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "guides_update" ON public.city_guides
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "guides_delete" ON public.city_guides
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- guide_entries
DROP POLICY IF EXISTS "entries_owner_all" ON public.guide_entries;
DROP POLICY IF EXISTS "entries_public_read" ON public.guide_entries;
DROP POLICY IF EXISTS "guide_entries_family_read" ON public.guide_entries;

CREATE POLICY "guide_entries_select" ON public.guide_entries
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.city_guides cg
      WHERE cg.id = guide_entries.guide_id
        AND cg.is_public = true
    )
    OR public.is_family_member(user_id)
  );

CREATE POLICY "guide_entries_insert" ON public.guide_entries
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "guide_entries_update" ON public.guide_entries
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "guide_entries_delete" ON public.guide_entries
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- families
DROP POLICY IF EXISTS "families_member_select" ON public.families;
DROP POLICY IF EXISTS "families_creator_select" ON public.families;

CREATE POLICY "families_select" ON public.families
  FOR SELECT
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.family_members fm
      WHERE fm.family_id = families.id
        AND fm.user_id = (SELECT auth.uid())
        AND fm.accepted_at IS NOT NULL
    )
  );

-- loyalty_programs
DROP POLICY IF EXISTS "loyalty_programs_self" ON public.loyalty_programs;
DROP POLICY IF EXISTS "loyalty_family_read" ON public.loyalty_programs;

CREATE POLICY "loyalty_programs_select" ON public.loyalty_programs
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_family_member(user_id)
  );

CREATE POLICY "loyalty_programs_insert" ON public.loyalty_programs
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "loyalty_programs_update" ON public.loyalty_programs
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "loyalty_programs_delete" ON public.loyalty_programs
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_collab_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_family_read" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR public.is_family_member(id)
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      JOIN public.trip_collaborators tc ON tc.trip_id = t.id
      WHERE t.user_id = profiles.id
        AND tc.user_id = (SELECT auth.uid())
        AND tc.accepted_at IS NOT NULL
    )
  );

-- Keep existing profiles insert/update policies unchanged.
