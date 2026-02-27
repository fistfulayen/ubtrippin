-- PRD 015 Phase 1 — Family Sharing

-- -----------------------------------------------------------------------
-- Families
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  invite_token text UNIQUE,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id)
);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_token ON public.family_members (invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members (family_id);

-- -----------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pg_function_is_visible(oid)) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_families_updated_at' AND tgrelid = 'public.families'::regclass
    ) THEN
      CREATE TRIGGER trg_families_updated_at
      BEFORE UPDATE ON public.families
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_family_members_updated_at' AND tgrelid = 'public.family_members'::regclass
    ) THEN
      CREATE TRIGGER trg_family_members_updated_at
      BEFORE UPDATE ON public.family_members
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
  ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pg_function_is_visible(oid)) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_families_updated_at' AND tgrelid = 'public.families'::regclass
    ) THEN
      CREATE TRIGGER trg_families_updated_at
      BEFORE UPDATE ON public.families
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_family_members_updated_at' AND tgrelid = 'public.family_members'::regclass
    ) THEN
      CREATE TRIGGER trg_family_members_updated_at
      BEFORE UPDATE ON public.family_members
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- SECURITY DEFINER helper for cross-user family access checks
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_family_member(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = auth.uid()
      AND fm2.user_id = target_user_id
      AND fm1.accepted_at IS NOT NULL
      AND fm2.accepted_at IS NOT NULL
      AND fm1.user_id <> fm2.user_id
  );
$$;

-- -----------------------------------------------------------------------
-- Families RLS
-- -----------------------------------------------------------------------
CREATE POLICY "families_member_select" ON public.families
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = families.id
        AND user_id = auth.uid()
        AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "families_create" ON public.families
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "families_admin_update" ON public.families
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = families.id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "families_admin_delete" ON public.families
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_id = families.id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND accepted_at IS NOT NULL
    )
  );

-- family_members: can see your own row, or all rows in families you belong to
CREATE POLICY "family_members_select" ON public.family_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.family_members fm2
      WHERE fm2.family_id = family_members.family_id
        AND fm2.user_id = auth.uid()
        AND fm2.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "family_members_admin_insert" ON public.family_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_members fm2
      WHERE fm2.family_id = family_members.family_id
        AND fm2.user_id = auth.uid()
        AND fm2.role = 'admin'
        AND fm2.accepted_at IS NOT NULL
    )
    OR family_members.invited_by = auth.uid()
  );

CREATE POLICY "family_members_self_delete" ON public.family_members
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "family_members_admin_delete" ON public.family_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm2
      WHERE fm2.family_id = family_members.family_id
        AND fm2.user_id = auth.uid()
        AND fm2.role = 'admin'
        AND fm2.accepted_at IS NOT NULL
    )
  );

-- -----------------------------------------------------------------------
-- Additive family-sharing RLS policies on existing tables
-- -----------------------------------------------------------------------
CREATE POLICY "trips_family_read" ON public.trips
  FOR SELECT USING (public.is_family_member(user_id));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'loyalty_programs'
  ) THEN
    CREATE POLICY "loyalty_family_read" ON public.loyalty_programs
      FOR SELECT USING (public.is_family_member(user_id));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'city_guides'
  ) THEN
    CREATE POLICY "guides_family_read" ON public.city_guides
      FOR SELECT USING (public.is_family_member(user_id));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'guide_entries'
  ) THEN
    CREATE POLICY "guide_entries_family_read" ON public.guide_entries
      FOR SELECT USING (public.is_family_member(user_id));
  END IF;
END $$;

CREATE POLICY "trip_items_family_read" ON public.trip_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_items.trip_id
        AND public.is_family_member(trips.user_id)
    )
  );

CREATE POLICY "trip_items_family_insert" ON public.trip_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_items.trip_id
        AND public.is_family_member(trips.user_id)
    )
  );

CREATE POLICY "trip_items_family_update" ON public.trip_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_items.trip_id
        AND public.is_family_member(trips.user_id)
    )
  );

-- -----------------------------------------------------------------------
-- Add author fields to guide_places when table exists
-- -----------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guide_places') THEN
    ALTER TABLE public.guide_places ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id);
    ALTER TABLE public.guide_places ADD COLUMN IF NOT EXISTS author_name text;
  END IF;
END $$;
