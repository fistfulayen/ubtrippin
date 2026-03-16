-- PRD-052 Phase 1 — Trip update notification emails

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"trip_updates": true}'::jsonb;

CREATE TABLE IF NOT EXISTS public.trip_update_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_trip_update_log_trip_created
  ON public.trip_update_log(trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_update_log_trip_pending
  ON public.trip_update_log(trip_id, created_at ASC)
  WHERE notified_at IS NULL;

ALTER TABLE public.trip_update_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_update_log_select" ON public.trip_update_log;
CREATE POLICY "trip_update_log_select" ON public.trip_update_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_update_log.trip_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_collaborators tc
            WHERE tc.trip_id = t.id
              AND tc.user_id = auth.uid()
              AND tc.accepted_at IS NOT NULL
          )
          OR EXISTS (
            SELECT 1
            FROM public.family_members fm1
            JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
            WHERE fm1.user_id = auth.uid()
              AND fm2.user_id = t.user_id
              AND fm1.accepted_at IS NOT NULL
              AND fm2.accepted_at IS NOT NULL
          )
        )
    )
  );

DROP POLICY IF EXISTS "trip_update_log_insert" ON public.trip_update_log;
CREATE POLICY "trip_update_log_insert" ON public.trip_update_log
  FOR INSERT WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_update_log.trip_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_collaborators tc
            WHERE tc.trip_id = t.id
              AND tc.user_id = auth.uid()
              AND tc.role IN ('owner', 'editor')
              AND tc.accepted_at IS NOT NULL
          )
          OR EXISTS (
            SELECT 1
            FROM public.family_members fm1
            JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
            WHERE fm1.user_id = auth.uid()
              AND fm2.user_id = t.user_id
              AND fm1.accepted_at IS NOT NULL
              AND fm2.accepted_at IS NOT NULL
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.get_trip_update_notification_recipients(
  p_trip_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  notification_preferences jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  WITH requester_has_access AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = p_trip_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_collaborators tc
            WHERE tc.trip_id = t.id
              AND tc.user_id = auth.uid()
              AND tc.accepted_at IS NOT NULL
          )
          OR EXISTS (
            SELECT 1
            FROM public.family_members fm1
            JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
            WHERE fm1.user_id = auth.uid()
              AND fm2.user_id = t.user_id
              AND fm1.accepted_at IS NOT NULL
              AND fm2.accepted_at IS NOT NULL
          )
        )
    ) AS allowed
  ),
  owner_recipient AS (
    SELECT p.id AS user_id, p.email, p.full_name, p.notification_preferences
    FROM public.trips t
    JOIN public.profiles p ON p.id = t.user_id
    WHERE t.id = p_trip_id
  ),
  family_recipients AS (
    SELECT DISTINCT p.id AS user_id, p.email, p.full_name, p.notification_preferences
    FROM public.trips t
    JOIN public.family_members owner_member
      ON owner_member.user_id = t.user_id
     AND owner_member.accepted_at IS NOT NULL
    JOIN public.family_members family_member
      ON family_member.family_id = owner_member.family_id
     AND family_member.user_id IS NOT NULL
     AND family_member.accepted_at IS NOT NULL
    JOIN public.profiles p ON p.id = family_member.user_id
    WHERE t.id = p_trip_id
  ),
  collaborator_recipients AS (
    SELECT DISTINCT p.id AS user_id, p.email, p.full_name, p.notification_preferences
    FROM public.trip_collaborators tc
    JOIN public.profiles p ON p.id = tc.user_id
    WHERE tc.trip_id = p_trip_id
      AND tc.user_id IS NOT NULL
      AND tc.accepted_at IS NOT NULL
  ),
  combined AS (
    SELECT * FROM owner_recipient
    UNION
    SELECT * FROM family_recipients
    UNION
    SELECT * FROM collaborator_recipients
  )
  SELECT c.user_id, c.email, c.full_name, c.notification_preferences
  FROM combined c
  WHERE EXISTS (
    SELECT 1
    FROM requester_has_access
    WHERE allowed
  )
    AND (p_actor_id IS NULL OR c.user_id <> p_actor_id)
    AND COALESCE((c.notification_preferences ->> 'trip_updates')::boolean, true);
$$;

CREATE OR REPLACE FUNCTION public.get_pending_trip_update_events(p_trip_id uuid)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  actor_id uuid,
  event_type text,
  event_data jsonb,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  WITH requester_has_access AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = p_trip_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.trip_collaborators tc
            WHERE tc.trip_id = t.id
              AND tc.user_id = auth.uid()
              AND tc.accepted_at IS NOT NULL
          )
          OR EXISTS (
            SELECT 1
            FROM public.family_members fm1
            JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
            WHERE fm1.user_id = auth.uid()
              AND fm2.user_id = t.user_id
              AND fm1.accepted_at IS NOT NULL
              AND fm2.accepted_at IS NOT NULL
          )
        )
    ) AS allowed
  )
  SELECT tul.id, tul.trip_id, tul.actor_id, tul.event_type, tul.event_data, tul.created_at
  FROM public.trip_update_log tul
  WHERE tul.trip_id = p_trip_id
    AND tul.notified_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM requester_has_access
      WHERE allowed
    )
  ORDER BY tul.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.mark_trip_update_events_notified(
  p_trip_id uuid,
  p_event_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND (
        t.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.trip_collaborators tc
          WHERE tc.trip_id = t.id
            AND tc.user_id = auth.uid()
            AND tc.accepted_at IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM public.family_members fm1
          JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
          WHERE fm1.user_id = auth.uid()
            AND fm2.user_id = t.user_id
            AND fm1.accepted_at IS NOT NULL
            AND fm2.accepted_at IS NOT NULL
        )
      )
  ) THEN
    RETURN;
  END IF;

  UPDATE public.trip_update_log
  SET notified_at = now()
  WHERE trip_id = p_trip_id
    AND id = ANY(p_event_ids)
    AND notified_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trip_update_notification_recipients(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trip_update_notification_recipients(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_pending_trip_update_events(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_trip_update_events(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_trip_update_events_notified(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_trip_update_events_notified(uuid, uuid[]) TO authenticated, service_role;
