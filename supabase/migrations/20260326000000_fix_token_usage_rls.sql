DROP POLICY IF EXISTS "token_usage_select" ON public.token_usage;
CREATE POLICY "token_usage_select" ON public.token_usage FOR SELECT USING (user_id = auth.uid());
