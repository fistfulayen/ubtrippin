ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_username text,
  ADD COLUMN IF NOT EXISTS public_username_changed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_username_lower
  ON public.profiles (LOWER(public_username))
  WHERE public_username IS NOT NULL;

ALTER TABLE public.city_guides
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS public_username text;

UPDATE public.city_guides
SET visibility = CASE
  WHEN is_public = true THEN 'public'
  ELSE 'private'
END
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'city_guides'
    AND column_name = 'is_public'
);

UPDATE public.city_guides cg
SET public_username = p.public_username
FROM public.profiles p
WHERE p.id = cg.user_id
  AND cg.public_username IS DISTINCT FROM p.public_username;

ALTER TABLE public.city_guides
  DROP CONSTRAINT IF EXISTS city_guides_visibility_check;

ALTER TABLE public.city_guides
  ADD CONSTRAINT city_guides_visibility_check
  CHECK (visibility IN ('private', 'public'));

ALTER TABLE public.city_guides
  DROP COLUMN IF EXISTS is_public;

CREATE INDEX IF NOT EXISTS idx_city_guides_visibility_updated_at
  ON public.city_guides (visibility, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_city_guides_public_city
  ON public.city_guides (LOWER(city))
  WHERE visibility = 'public';

DROP POLICY IF EXISTS "guides_select" ON public.city_guides;
DROP POLICY IF EXISTS "guides_insert" ON public.city_guides;
DROP POLICY IF EXISTS "guides_update" ON public.city_guides;
DROP POLICY IF EXISTS "guides_delete" ON public.city_guides;

CREATE POLICY "guides_select" ON public.city_guides
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR visibility = 'public'
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

DROP POLICY IF EXISTS "guide_entries_select" ON public.guide_entries;
DROP POLICY IF EXISTS "guide_entries_insert" ON public.guide_entries;
DROP POLICY IF EXISTS "guide_entries_update" ON public.guide_entries;
DROP POLICY IF EXISTS "guide_entries_delete" ON public.guide_entries;

CREATE POLICY "guide_entries_select" ON public.guide_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.city_guides cg
      WHERE cg.id = guide_entries.guide_id
        AND (
          cg.user_id = (SELECT auth.uid())
          OR cg.visibility = 'public'
          OR public.is_family_member(cg.user_id)
        )
    )
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
