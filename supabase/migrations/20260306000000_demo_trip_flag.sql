-- PRD-035: Mark sample trips so onboarding/demo flows can identify them.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_trips_user_is_demo
  ON public.trips (user_id, is_demo);
