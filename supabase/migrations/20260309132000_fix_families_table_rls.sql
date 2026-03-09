-- Fix families table RLS.
-- Migration 20260309112000 set policies to use is_family_member_of(id) which
-- expects a USER id, not a family id. Always returns false.
-- Replace with is_member_of_family(id) and is_admin_of_family(id) which
-- correctly take a family_id parameter.

DROP POLICY IF EXISTS "families_member_select" ON public.families;
DROP POLICY IF EXISTS "families_admin_update" ON public.families;
DROP POLICY IF EXISTS "families_admin_delete" ON public.families;

-- SELECT: members can see their families
CREATE POLICY "families_member_select" ON public.families
  FOR SELECT USING (
    created_by = auth.uid()
    OR public.is_member_of_family(id)
  );

-- UPDATE: only admins
CREATE POLICY "families_admin_update" ON public.families
  FOR UPDATE USING (
    public.is_admin_of_family(id)
  );

-- DELETE: only admins
CREATE POLICY "families_admin_delete" ON public.families
  FOR DELETE USING (
    public.is_admin_of_family(id)
  );

NOTIFY pgrst, 'reload schema';
