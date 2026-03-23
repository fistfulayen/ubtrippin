-- PRD-033 Phase 1.1: Fix function search_path for remaining 4 functions
-- These functions without pinned search_path are a privilege escalation vector

ALTER FUNCTION public.clear_trip_weather_cache() SET search_path = public, extensions;
ALTER FUNCTION public.set_feedback_resolved_at() SET search_path = public, extensions;
ALTER FUNCTION public.touch_weather_cache_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.update_city_events_updated_at() SET search_path = public, extensions;
