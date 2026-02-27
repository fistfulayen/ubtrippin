-- Allow users to SELECT families they created (needed for INSERT...RETURNING)
CREATE POLICY "families_creator_select" ON public.families
  FOR SELECT USING (created_by = auth.uid());
