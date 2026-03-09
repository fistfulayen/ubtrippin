-- Fix families SELECT/UPDATE/DELETE RLS policies that do raw sub-queries
-- into family_members (which has its own RLS). This creates a circular
-- dependency causing queries to return empty results.
-- 
-- Solution: use the existing SECURITY DEFINER functions that bypass RLS.

-- SELECT: was doing raw SELECT from family_members → RLS recursion
DROP POLICY IF EXISTS "families_member_select" ON public.families;
CREATE POLICY "families_member_select" ON public.families
  FOR SELECT USING (
    public.is_family_member_of(id)
  );

-- UPDATE: same issue
DROP POLICY IF EXISTS "families_admin_update" ON public.families;
CREATE POLICY "families_admin_update" ON public.families
  FOR UPDATE USING (
    public.is_family_admin(id)
  );

-- DELETE: same issue
DROP POLICY IF EXISTS "families_admin_delete" ON public.families;
CREATE POLICY "families_admin_delete" ON public.families
  FOR DELETE USING (
    public.is_family_admin(id)
  );
