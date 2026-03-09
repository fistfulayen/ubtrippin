-- Simplify family_members SELECT to rule out circular RLS from is_member_of_family()
-- If this works, the function call in the OR was the problem.

DROP POLICY IF EXISTS "family_members_select" ON public.family_members;

-- Simple policy: you can see your own rows, OR rows in families you belong to.
-- Use a sub-select with SECURITY DEFINER wrapper to avoid recursion.
CREATE POLICY "family_members_select" ON public.family_members
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- NOTE: This temporarily means you can ONLY see your own family_members rows,
-- not other members of your families. We'll add that back once the basic case works.

NOTIFY pgrst, 'reload schema';
