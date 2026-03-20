-- Restore family_members SELECT policy to show all members in your families.
-- The migration 20260309131000 stripped this to user_id = auth.uid() as a
-- "temporary" fix for circular RLS — but is_member_of_family() is a
-- SECURITY DEFINER function that doesn't trigger recursion.
-- That temp fix was never reverted, so family pages show only yourself.

DROP POLICY IF EXISTS "family_members_select" ON public.family_members;

CREATE POLICY "family_members_select" ON public.family_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_member_of_family(family_id)
  );

NOTIFY pgrst, 'reload schema';
