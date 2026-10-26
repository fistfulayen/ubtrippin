BEGIN;

-- Billing contact information is not an authentication identity. Do not
-- rewrite existing profiles or previously verified sender ownership here.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_email text;
COMMENT ON COLUMN public.profiles.billing_email IS
  'Stripe billing contact only; never an authentication or administrator identity';
REVOKE UPDATE (billing_email) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name',
          NEW.raw_user_meta_data ->> 'avatar_url');

  INSERT INTO public.allowed_senders (user_id, email, label, verified)
  VALUES (NEW.id, NEW.email, 'Primary Email', NEW.email_confirmed_at IS NOT NULL);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_confirmed_primary_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.allowed_senders (user_id, email, label, verified)
    VALUES (NEW.id, NEW.email, 'Primary Email', true)
    ON CONFLICT (user_id, email) DO UPDATE SET verified = true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_confirmed_primary_sender() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_email_confirmed
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL AND
      (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
       OR OLD.email IS DISTINCT FROM NEW.email))
EXECUTE FUNCTION public.sync_confirmed_primary_sender();

COMMIT;
