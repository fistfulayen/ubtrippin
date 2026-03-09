-- Fix family_members INSERT policy.
-- Migration 20260309130000 replaced the original INSERT policy but dropped
-- the `invited_by = auth.uid()` clause needed for bootstrap (creating
-- the first admin member when a family is created).

DROP POLICY IF EXISTS "family_members_admin_insert" ON public.family_members;

CREATE POLICY "family_members_admin_insert" ON public.family_members
  FOR INSERT WITH CHECK (
    public.is_admin_of_family(family_id)
    OR family_members.invited_by = auth.uid()
  );

NOTIFY pgrst, 'reload schema';
