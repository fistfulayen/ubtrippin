-- PRD-033 Phase 1.1: Fix function search_path mutable (8 functions)
-- Pin search_path to prevent privilege escalation via schema shadowing.

ALTER FUNCTION public.increment_example_usage(uuid[])
  SET search_path = public, extensions;

ALTER FUNCTION public.touch_trip_collaborator()
  SET search_path = public, extensions;

ALTER FUNCTION public.update_guide_entry_count()
  SET search_path = public, extensions;

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, extensions;

ALTER FUNCTION public.guides_nearby(uuid, double precision, double precision, double precision)
  SET search_path = public, extensions;

ALTER FUNCTION public.notify_webhook_delivery()
  SET search_path = public, extensions;

ALTER FUNCTION public.update_feedback_votes_count()
  SET search_path = public, extensions;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, extensions;

-- PRD-033 Phase 1.2: Add policy for webhook_delivery_queue
-- Table has RLS enabled but no policies (server-side only via service role).
-- Add explicit deny-all via restrictive "no API access" comment,
-- or a service-only policy. Since this table is only used by the
-- webhook delivery cron, no PostgREST access is needed.
-- A SELECT policy for the owner is harmless and clears the linter warning.

CREATE POLICY "webhook_queue_service_only"
  ON public.webhook_delivery_queue
  FOR SELECT
  USING (false);
