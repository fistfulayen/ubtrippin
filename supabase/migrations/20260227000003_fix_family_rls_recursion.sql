-- Fix infinite recursion in family_members RLS
-- Same pattern as is_trip_owner() fix: use SECURITY DEFINER function

-- Drop the recursive policy
DROP POLICY IF EXISTS "family_members_select" ON public.family_members;

-- Create a SECURITY DEFINER function to check family membership
CREATE OR REPLACE FUNCTION public.is_family_member_of(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = target_family_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  );
$$;

-- Recreate the policy using the SECURITY DEFINER function
CREATE POLICY "family_members_select" ON public.family_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_family_member_of(family_id)
  );

-- Also fix family_members_admin_insert — it has the same recursion issue
DROP POLICY IF EXISTS "family_members_admin_insert" ON public.family_members;

CREATE OR REPLACE FUNCTION public.is_family_admin(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = target_family_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND accepted_at IS NOT NULL
  );
$$;

CREATE POLICY "family_members_admin_insert" ON public.family_members
  FOR INSERT WITH CHECK (
    public.is_family_admin(family_id)
    OR invited_by = auth.uid()
  );

-- Fix family_members_admin_delete — same issue
DROP POLICY IF EXISTS "family_members_admin_delete" ON public.family_members;

CREATE POLICY "family_members_admin_delete" ON public.family_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR public.is_family_admin(family_id)
  );

-- Drop the redundant self-delete policy (now covered by admin_delete above)
DROP POLICY IF EXISTS "family_members_self_delete" ON public.family_members;
