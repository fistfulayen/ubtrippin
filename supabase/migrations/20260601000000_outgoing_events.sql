-- Outgoing event source integration.
-- Adds source metadata for tracked cities, idempotent Outgoing event writes, and public shelf cache.

ALTER TABLE public.tracked_cities
  ADD COLUMN IF NOT EXISTS h3_cell text,
  ADD COLUMN IF NOT EXISTS event_source text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS outgoing_refresh_started_at timestamptz;

ALTER TABLE public.city_events
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS city_events_outgoing_identity
  ON public.city_events(city_id, source, external_id)
  WHERE source = 'outgoing' AND external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_city_events_source_outgoing
  ON public.city_events(city_id, start_date)
  WHERE source = 'outgoing';

CREATE TABLE IF NOT EXISTS public.outgoing_shelves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.tracked_cities(id) ON DELETE CASCADE,
  shelf_slug text NOT NULL,
  display_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  activity_ids text[] NOT NULL DEFAULT '{}',
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city_id, shelf_slug)
);

ALTER TABLE public.outgoing_shelves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.outgoing_shelves
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_outgoing_shelves_city_sort
  ON public.outgoing_shelves(city_id, sort_order);

UPDATE public.tracked_cities
SET event_source = 'outgoing'
WHERE slug IN ('paris', 'new-york', 'tokyo', 'barcelona', 'berlin', 'amsterdam');
