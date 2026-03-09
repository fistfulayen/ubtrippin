-- Fix: family_members has NO select policy after CASCADE drop in 20260304000002.
-- The original policy referenced is_family_member_of() which was dropped with CASCADE,
-- taking the policy with it.
--
-- Recreate using SECURITY DEFINER helper to avoid RLS recursion.

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
