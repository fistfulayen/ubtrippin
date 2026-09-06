-- Close database authorization gaps found by the September 2026 security review.

-- Profiles are account records, not relationship DTOs. Relationship readers use
-- the deliberately narrow shared_profiles view below.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_collab_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_family_read" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  full_name,
  avatar_url,
  calendar_token,
  notification_preferences,
  welcome_email_sent,
  onboarding_completed
) ON public.profiles TO authenticated;

DROP VIEW IF EXISTS public.shared_profiles;
CREATE VIEW public.shared_profiles
WITH (security_barrier = true)
AS
SELECT p.id, p.full_name, p.avatar_url, p.public_username
FROM public.profiles p
WHERE auth.role() = 'service_role'
   OR p.id = auth.uid()
   OR public.is_family_member(p.id)
   OR EXISTS (
     SELECT 1
     FROM public.trips t
     JOIN public.trip_collaborators tc ON tc.trip_id = t.id
     WHERE t.user_id = p.id
       AND tc.user_id = auth.uid()
       AND tc.accepted_at IS NOT NULL
   )
   OR EXISTS (
     SELECT 1 FROM public.feedback f WHERE f.user_id = p.id
   );

REVOKE ALL ON public.shared_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.shared_profiles TO authenticated, service_role;

-- Secondary senders stay inactive until mailbox ownership is verified. Active
-- identities are globally unique so inbound routing is deterministic.
DROP POLICY IF EXISTS "Users can manage own allowed senders" ON public.allowed_senders;
CREATE POLICY "allowed_senders_select_own" ON public.allowed_senders
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "allowed_senders_insert_unverified_own" ON public.allowed_senders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND verified IS FALSE);
CREATE POLICY "allowed_senders_delete_own" ON public.allowed_senders
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE UPDATE ON public.allowed_senders FROM PUBLIC, anon, authenticated;
WITH ranked_verified_senders AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY email
           ORDER BY created_at ASC, id ASC
         ) AS verified_rank
  FROM public.allowed_senders
  WHERE verified IS TRUE
)
UPDATE public.allowed_senders candidate
SET verified = false
FROM ranked_verified_senders ranked
WHERE candidate.id = ranked.id
  AND ranked.verified_rank > 1;
CREATE UNIQUE INDEX IF NOT EXISTS allowed_senders_one_verified_owner_per_email
  ON public.allowed_senders (email) WHERE verified IS TRUE;

-- A linked item must be authorized through the referenced trip. Merely owning
-- an arbitrary user_id value can no longer authorize a cross-tenant trip_id.
DROP POLICY IF EXISTS "trip_items_insert" ON public.trip_items;
DROP POLICY IF EXISTS "trip_items_update" ON public.trip_items;
DROP POLICY IF EXISTS "trip_items_delete" ON public.trip_items;

CREATE POLICY "trip_items_insert" ON public.trip_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (trip_id IS NULL AND user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND trip_items.user_id = t.user_id
        AND (
          t.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.trip_collaborators tc
            WHERE tc.trip_id = t.id
              AND tc.user_id = (SELECT auth.uid())
              AND tc.role = 'editor'
              AND tc.accepted_at IS NOT NULL
          )
          OR public.is_family_member(t.user_id)
        )
    )
  );

CREATE POLICY "trip_items_update" ON public.trip_items
  FOR UPDATE TO authenticated
  USING (
    (trip_id IS NULL AND user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND (
          t.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.trip_collaborators tc
            WHERE tc.trip_id = t.id
              AND tc.user_id = (SELECT auth.uid())
              AND tc.role = 'editor'
              AND tc.accepted_at IS NOT NULL
          )
          OR public.is_family_member(t.user_id)
        )
    )
  )
  WITH CHECK (
    (trip_id IS NULL AND user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND trip_items.user_id = t.user_id
        AND (
          t.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.trip_collaborators tc
            WHERE tc.trip_id = t.id
              AND tc.user_id = (SELECT auth.uid())
              AND tc.role = 'editor'
              AND tc.accepted_at IS NOT NULL
          )
          OR public.is_family_member(t.user_id)
        )
    )
  );

CREATE POLICY "trip_items_delete" ON public.trip_items
  FOR DELETE TO authenticated
  USING (
    (trip_id IS NULL AND user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_items.trip_id
        AND (
          t.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.trip_collaborators tc
            WHERE tc.trip_id = t.id
              AND tc.user_id = (SELECT auth.uid())
              AND tc.role = 'editor'
              AND tc.accepted_at IS NOT NULL
          )
          OR public.is_family_member(t.user_id)
        )
    )
  );

-- Storage locators inside item JSON are server-managed capabilities.
CREATE OR REPLACE FUNCTION public.protect_trip_item_storage_locators()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' AND (
      NEW.details_json ? 'ticket_pdf_bucket'
      OR NEW.details_json ? 'ticket_pdf_path'
    ) THEN
      RAISE EXCEPTION 'ticket attachment locators are server-managed';
    END IF;

    IF TG_OP = 'UPDATE' AND (
      NEW.details_json -> 'ticket_pdf_bucket' IS DISTINCT FROM OLD.details_json -> 'ticket_pdf_bucket'
      OR NEW.details_json -> 'ticket_pdf_path' IS DISTINCT FROM OLD.details_json -> 'ticket_pdf_path'
    ) THEN
      RAISE EXCEPTION 'ticket attachment locators are server-managed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_trip_item_storage_locators ON public.trip_items;
CREATE TRIGGER protect_trip_item_storage_locators
  BEFORE INSERT OR UPDATE ON public.trip_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_trip_item_storage_locators();

-- Only a family admin can add later members. Initial membership is created by
-- the service-only atomic function below.
DROP POLICY IF EXISTS "family_members_admin_insert" ON public.family_members;
CREATE POLICY "family_members_admin_insert" ON public.family_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_family_admin(family_id));

DROP POLICY IF EXISTS "families_create" ON public.families;
REVOKE INSERT ON public.families FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_family_with_admin_for_user(
  p_user_id uuid,
  p_name text
)
RETURNS SETOF public.families
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  created_family public.families%ROWTYPE;
  profile_email text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(btrim(p_name)) > 120 THEN
    RAISE EXCEPTION 'invalid family name';
  END IF;

  SELECT p.email INTO profile_email
  FROM public.profiles p
  WHERE p.id = p_user_id AND p.subscription_tier = 'pro';
  IF profile_email IS NULL THEN RAISE EXCEPTION 'eligible profile not found'; END IF;

  INSERT INTO public.families(name, created_by)
  VALUES (btrim(p_name), p_user_id)
  RETURNING * INTO created_family;

  INSERT INTO public.family_members(
    family_id, user_id, role, invited_email, invited_by, accepted_at, invite_token
  ) VALUES (
    created_family.id, p_user_id, 'admin', lower(profile_email), p_user_id, now(), NULL
  );

  RETURN NEXT created_family;
END;
$$;

REVOKE ALL ON FUNCTION public.create_family_with_admin_for_user(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_family_with_admin_for_user(uuid, text) TO service_role;

-- Invitees cannot update collaboration grants directly. Owner-facing routes
-- use an explicitly authorized service client and acceptance uses a narrow RPC.
DROP POLICY IF EXISTS "trip_collaborators_update" ON public.trip_collaborators;
REVOKE UPDATE ON public.trip_collaborators FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_trip_collaborator(
  p_token text,
  p_user_id uuid,
  p_email text
)
RETURNS TABLE(id uuid, trip_id uuid, role text, invited_email text, invited_by uuid, accepted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  RETURN QUERY
  UPDATE public.trip_collaborators tc
  SET user_id = p_user_id,
      accepted_at = now(),
      invite_token = NULL,
      updated_at = now()
  WHERE tc.invite_token = p_token
    AND tc.accepted_at IS NULL
    AND lower(tc.invited_email) = lower(p_email)
  RETURNING tc.id, tc.trip_id, tc.role, tc.invited_email, tc.invited_by, tc.accepted_at;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_trip_collaborator(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_trip_collaborator(text, uuid, text) TO service_role;

-- Direct profile previews no longer expose the account row. These narrow,
-- token-scoped functions also repair pending-invite previews that RLS hid.
CREATE OR REPLACE FUNCTION public.preview_trip_collaborator_invite(p_token text)
RETURNS TABLE(
  trip_id uuid,
  trip_title text,
  primary_location text,
  start_date date,
  end_date date,
  cover_image_url text,
  traveler_count int,
  role text,
  invited_email_hint text,
  inviter_name text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT tc.trip_id,
         t.title,
         t.primary_location,
         t.start_date,
         t.end_date,
         CASE
           WHEN t.cover_image_url ~ '^https://(images|plus)\.unsplash\.com/'
             OR t.cover_image_url ~ '^https://[^/]+\.supabase\.co/storage/v1/object/public/trip-images/'
           THEN t.cover_image_url
           ELSE NULL
         END,
         coalesce(cardinality(t.travelers), 0),
         tc.role,
         left(tc.invited_email, 2) || '***@' || split_part(tc.invited_email, '@', 2),
         coalesce(nullif(p.full_name, ''), 'Someone')
  FROM public.trip_collaborators tc
  JOIN public.trips t ON t.id = tc.trip_id
  LEFT JOIN public.profiles p ON p.id = tc.invited_by
  WHERE tc.invite_token = p_token AND tc.accepted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.preview_trip_collaborator_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_trip_collaborator_invite(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_family_invite(p_token text)
RETURNS TABLE(family_id uuid, family_name text, role text, invited_email_hint text, inviter_name text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT fm.family_id,
         f.name,
         fm.role,
         left(fm.invited_email, 2) || '***@' || split_part(fm.invited_email, '@', 2),
         coalesce(nullif(p.full_name, ''), 'Someone')
  FROM public.family_members fm
  JOIN public.families f ON f.id = fm.family_id
  LEFT JOIN public.profiles p ON p.id = fm.invited_by
  WHERE fm.invite_token = p_token AND fm.accepted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.preview_family_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_family_invite(text) TO anon, authenticated;

-- Prevent direct client storage writes and privileged affiliate self-approval.
DROP POLICY IF EXISTS "Service can upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service can upload email attachments" ON storage.objects;
DROP POLICY IF EXISTS affiliates_insert ON public.affiliates;
REVOKE INSERT ON public.affiliates FROM PUBLIC, anon, authenticated;

-- Bind definer RPC subjects to the authenticated caller. Service-role routes
-- may still provide the already-validated API-key user id.
CREATE OR REPLACE FUNCTION public.guides_nearby(
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision DEFAULT 5000
)
RETURNS TABLE (
  id uuid, guide_id uuid, user_id uuid, name text, category text, status text,
  description text, address text, latitude double precision, longitude double precision,
  website_url text, rating int, recommended_by text, tags text[], source text,
  source_url text, created_at timestamptz, city text, country text, distance_m double precision
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ge.id, ge.guide_id, ge.user_id, ge.name, ge.category, ge.status,
         ge.description, ge.address, ge.latitude, ge.longitude, ge.website_url,
         ge.rating, ge.recommended_by, ge.tags, ge.source, ge.source_url,
         ge.created_at, cg.city, cg.country,
         extensions.earth_distance(extensions.ll_to_earth(p_lat, p_lng), extensions.ll_to_earth(ge.latitude, ge.longitude)) AS distance_m
  FROM public.guide_entries ge
  JOIN public.city_guides cg ON cg.id = ge.guide_id
  WHERE ge.user_id = CASE WHEN auth.role() = 'service_role' THEN p_user_id ELSE auth.uid() END
    AND ge.latitude IS NOT NULL
    AND ge.longitude IS NOT NULL
    AND extensions.earth_distance(extensions.ll_to_earth(p_lat, p_lng), extensions.ll_to_earth(ge.latitude, ge.longitude))
        <= least(greatest(p_radius_m, 1), 50000)
  ORDER BY distance_m ASC;
$$;

REVOKE ALL ON FUNCTION public.guides_nearby(uuid, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guides_nearby(uuid, double precision, double precision, double precision) TO authenticated, service_role;

-- Stored covers may only point at the two upstream image hosts or application
-- managed public trip-image objects. The PDF sink applies the same allowlist.
CREATE OR REPLACE FUNCTION public.protect_trip_cover_url()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.cover_image_url IS NOT NULL
     AND NEW.cover_image_url !~ '^https://(images|plus)\.unsplash\.com/'
     AND NEW.cover_image_url !~ '^https://[^/]+\.supabase\.co/storage/v1/object/public/trip-images/'
  THEN
    RAISE EXCEPTION 'cover image URL must use an approved image origin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_trip_cover_url ON public.trips;
CREATE TRIGGER protect_trip_cover_url
  BEFORE INSERT OR UPDATE OF cover_image_url ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.protect_trip_cover_url();

-- Durable admission state replaces the five-minute OAuth-account heuristic.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admitted_at timestamptz;
UPDATE public.profiles SET admitted_at = coalesce(admitted_at, created_at, now());

-- New capabilities use 128 random bits. Rotate all still-unused legacy codes;
-- their old 32-bit values must not remain valid during the seven-day window.
ALTER TABLE public.invites
  ALTER COLUMN code SET DEFAULT upper(encode(extensions.gen_random_bytes(16), 'hex'));
UPDATE public.invites
SET code = upper(encode(extensions.gen_random_bytes(16), 'hex'))
WHERE used_at IS NULL AND length(code) < 32;

DROP POLICY IF EXISTS "invites_insert" ON public.invites;
REVOKE INSERT ON public.invites FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.weekly_invites_remaining(user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p.is_admin THEN 999
    ELSE greatest(0, 3 - (
      SELECT count(*)::int FROM public.invites i
      WHERE i.inviter_id = p.id
        AND i.created_at >= date_trunc('week', now())
    ))
  END
  FROM public.profiles p
  WHERE p.id = CASE WHEN auth.role() = 'service_role' THEN user_id ELSE auth.uid() END;
$$;

REVOKE ALL ON FUNCTION public.weekly_invites_remaining(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.weekly_invites_remaining(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_weekly_invite(p_user_id uuid)
RETURNS SETOF public.invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actual_user_id uuid;
  profile_is_admin boolean;
  profile_is_pro boolean;
  issued_count integer;
  created_invite public.invites%ROWTYPE;
BEGIN
  actual_user_id := CASE WHEN auth.role() = 'service_role' THEN p_user_id ELSE auth.uid() END;
  IF actual_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF auth.role() <> 'service_role' AND p_user_id IS DISTINCT FROM actual_user_id THEN
    RAISE EXCEPTION 'cannot issue invitations for another user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(actual_user_id::text || ':weekly-invites', 0));
  SELECT p.is_admin, p.subscription_tier = 'pro'
    INTO profile_is_admin, profile_is_pro
  FROM public.profiles p WHERE p.id = actual_user_id;
  IF NOT coalesce(profile_is_admin, false) AND NOT coalesce(profile_is_pro, false) THEN
    RAISE EXCEPTION 'invite feature requires pro';
  END IF;

  SELECT count(*)::int INTO issued_count
  FROM public.invites i
  WHERE i.inviter_id = actual_user_id
    AND i.created_at >= date_trunc('week', now());
  IF NOT coalesce(profile_is_admin, false) AND issued_count >= 3 THEN
    RAISE EXCEPTION 'weekly invite limit reached';
  END IF;

  INSERT INTO public.invites(inviter_id)
  VALUES (actual_user_id)
  RETURNING * INTO created_invite;
  RETURN NEXT created_invite;
END;
$$;

REVOKE ALL ON FUNCTION public.create_weekly_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_weekly_invite(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_referral_tree(user_id uuid)
RETURNS TABLE(invitee_id uuid, invitee_name text, joined_at timestamptz, depth int)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  WITH RECURSIVE tree AS (
    SELECT i.invitee_id, p.full_name AS invitee_name, i.used_at AS joined_at, 1 AS depth
    FROM public.invites i
    JOIN public.profiles p ON p.id = i.invitee_id
    WHERE i.inviter_id = CASE WHEN auth.role() = 'service_role' THEN user_id ELSE auth.uid() END
      AND i.invitee_id IS NOT NULL
    UNION ALL
    SELECT i.invitee_id, p.full_name, i.used_at, t.depth + 1
    FROM public.invites i
    JOIN public.profiles p ON p.id = i.invitee_id
    JOIN tree t ON t.invitee_id = i.inviter_id
    WHERE t.depth < 3
  )
  SELECT * FROM tree;
$$;

REVOKE ALL ON FUNCTION public.get_referral_tree(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_tree(uuid) TO authenticated, service_role;

-- Database-backed throttling protects public invite oracles across instances.
CREATE TABLE public.public_rate_limits (
  scope text NOT NULL,
  key_hash text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  PRIMARY KEY (scope, key_hash)
);
ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_rate_limits_deny_clients" ON public.public_rate_limits
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON public.public_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_public_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_count integer;
  current_reset timestamptz;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_limit < 1 OR p_window_seconds < 1 THEN RAISE EXCEPTION 'invalid rate limit'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_key_hash, 0));

  SELECT request_count, reset_at INTO current_count, current_reset
  FROM public.public_rate_limits
  WHERE scope = p_scope AND key_hash = p_key_hash;

  IF NOT FOUND OR current_reset <= now() THEN
    INSERT INTO public.public_rate_limits(scope, key_hash, request_count, reset_at)
    VALUES (p_scope, p_key_hash, 1, now() + make_interval(secs => p_window_seconds))
    ON CONFLICT (scope, key_hash) DO UPDATE
      SET request_count = 1, reset_at = EXCLUDED.reset_at;
    RETURN true;
  END IF;
  IF current_count >= p_limit THEN RETURN false; END IF;

  UPDATE public.public_rate_limits
  SET request_count = request_count + 1
  WHERE scope = p_scope AND key_hash = p_key_hash;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_rate_limit(text, text, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
