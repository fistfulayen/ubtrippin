-- Match execution privileges to each function's intended caller.
-- Revoke direct role grants as well as PUBLIC; Supabase may grant anon and
-- authenticated EXECUTE through default privileges independently of PUBLIC.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.expire_billing_grace_periods()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_billing_grace_periods() TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_request_user(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_request_user(uuid) TO service_role;

-- These preserve their existing auth.uid() tenant checks and authenticated
-- access. Anonymous clients have no legitimate notification worker identity.
REVOKE EXECUTE ON FUNCTION public.get_pending_trip_update_events(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_trip_update_notification_recipients(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_trip_update_events_notified(uuid, uuid[])
  FROM PUBLIC, anon;

COMMIT;
