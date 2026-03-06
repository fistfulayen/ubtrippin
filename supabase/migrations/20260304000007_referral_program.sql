-- PRD-039: Referral program tracking infrastructure

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_referral_code_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  alphabet CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  next_code text;
  i integer;
BEGIN
  LOOP
    next_code := '';

    FOR i IN 1..8 LOOP
      next_code := next_code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.referral_code = next_code
    );
  END LOOP;

  RETURN next_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR btrim(NEW.referral_code) = '' THEN
    NEW.referral_code := public.generate_referral_code();
  ELSE
    NEW.referral_code := upper(btrim(NEW.referral_code));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_referral_code ON public.profiles;
CREATE TRIGGER set_profile_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.assign_profile_referral_code();

UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL OR btrim(referral_code) = '';

UPDATE public.profiles
SET referral_code = upper(btrim(referral_code))
WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'converted', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  UNIQUE(referee_id),
  UNIQUE(referrer_id, referee_id),
  CHECK (referrer_id <> referee_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own"
  ON public.referrals
  FOR SELECT
  USING (
    referrer_id = (SELECT auth.uid())
    OR referee_id = (SELECT auth.uid())
  );

CREATE POLICY "referrals_insert_self"
  ON public.referrals
  FOR INSERT
  WITH CHECK (
    referee_id = (SELECT auth.uid())
  );

CREATE POLICY "referrals_update_self"
  ON public.referrals
  FOR UPDATE
  USING (
    referee_id = (SELECT auth.uid())
  )
  WITH CHECK (
    referee_id = (SELECT auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON public.referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

CREATE OR REPLACE FUNCTION public.resolve_referrer_id_by_code(input_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.referral_code = upper(btrim(input_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_referrer_id_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_referrer_id_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_referrer_id_by_code(text) TO authenticated;
