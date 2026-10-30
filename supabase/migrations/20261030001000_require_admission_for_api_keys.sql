BEGIN;

-- Checking admission in the key-creation route alone leaves direct PostgREST
-- inserts available. Preserve owner reads/revocation and require admission for
-- every new or updated key. Service-managed invitation/account setup is unchanged.
DROP POLICY IF EXISTS "Users can manage own API keys" ON public.api_keys;
CREATE POLICY "Users can manage own API keys"
ON public.api_keys FOR ALL TO public
USING ((SELECT auth.uid()) = user_id)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.admitted_at IS NOT NULL
  )
);

COMMIT;
