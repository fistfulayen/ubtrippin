-- Fix: family_members has NO select policy after CASCADE drop in 20260304000002.
-- The original policy referenced is_family_member_of() which was dropped with CASCADE,
-- taking the policy with it.
--
-- Recreate using SECURITY DEFINER helper to avoid RLS recursion.

-- Create is_member_of_family(family_id) — checks if current user belongs to the given family.
-- (The old is_family_member_of was redefined in 20260304000002 to take a user_id, so we
-- need a new function with family_id semantics.)
CREATE OR REPLACE FUNCTION public.is_member_of_family(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = target_family_id
      AND user_id = (SELECT auth.uid())
      AND accepted_at IS NOT NULL
  );
$$;

-- Create is_admin_of_family(family_id) — checks if current user is admin of the given family.
CREATE OR REPLACE FUNCTION public.is_admin_of_family(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = target_family_id
      AND user_id = (SELECT auth.uid())
      AND role = 'admin'
      AND accepted_at IS NOT NULL
  );
$$;

-- Also recreate insert/delete policies that may have been lost to CASCADE.
-- Drop any remnants first.
DROP POLICY IF EXISTS "family_members_select" ON public.family_members;
DROP POLICY IF EXISTS "family_members_admin_insert" ON public.family_members;
DROP POLICY IF EXISTS "family_members_self_delete" ON public.family_members;
DROP POLICY IF EXISTS "family_members_admin_delete" ON public.family_members;

-- SELECT: see own rows + rows in families you belong to
CREATE POLICY "family_members_select" ON public.family_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_member_of_family(family_id)
  );

-- INSERT: only family admins can add members
CREATE POLICY "family_members_admin_insert" ON public.family_members
  FOR INSERT WITH CHECK (
    public.is_admin_of_family(family_id)
  );

-- DELETE own membership
CREATE POLICY "family_members_self_delete" ON public.family_members
  FOR DELETE USING (user_id = auth.uid());

-- DELETE: admins can remove members
CREATE POLICY "family_members_admin_delete" ON public.family_members
  FOR DELETE USING (
    public.is_admin_of_family(family_id)
  );
