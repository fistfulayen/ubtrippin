-- Fix families RLS: is_family_member_of was redefined in 20260304000002 to take
-- target_user_id (checks if users share a family) instead of target_family_id
-- (checks if user belongs to a family). The policies on families table were
-- passing families.id (a family UUID) to a function expecting a user UUID.
--
-- Solution: create correctly-named functions that take a family_id.

CREATE OR REPLACE FUNCTION public.is_member_of_family(fid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = fid
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_family(fid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = fid
      AND user_id = auth.uid()
      AND role = 'admin'
      AND accepted_at IS NOT NULL
  );
$$;

-- Replace the broken policies
DROP POLICY IF EXISTS "families_member_select" ON public.families;
CREATE POLICY "families_member_select" ON public.families
  FOR SELECT USING (public.is_member_of_family(id));

DROP POLICY IF EXISTS "families_admin_update" ON public.families;
CREATE POLICY "families_admin_update" ON public.families
  FOR UPDATE USING (public.is_admin_of_family(id));

DROP POLICY IF EXISTS "families_admin_delete" ON public.families;
CREATE POLICY "families_admin_delete" ON public.families
  FOR DELETE USING (public.is_admin_of_family(id));
