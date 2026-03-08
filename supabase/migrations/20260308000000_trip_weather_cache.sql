CREATE TABLE IF NOT EXISTS public.trip_weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city text NOT NULL,
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  temperature_unit text NOT NULL DEFAULT 'fahrenheit' CHECK (temperature_unit IN ('fahrenheit', 'celsius')),
  forecast_json jsonb NOT NULL,
  source text NOT NULL DEFAULT 'forecast',
  packing_json jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.trip_weather_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own weather data" ON public.trip_weather_cache;
CREATE POLICY "Users see own weather data"
  ON public.trip_weather_cache
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_family_member(user_id)
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_weather_cache.trip_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users insert own weather data" ON public.trip_weather_cache;
CREATE POLICY "Users insert own weather data"
  ON public.trip_weather_cache
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_family_member(user_id)
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_weather_cache.trip_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users update own weather data" ON public.trip_weather_cache;
CREATE POLICY "Users update own weather data"
  ON public.trip_weather_cache
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_family_member(user_id)
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_weather_cache.trip_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_family_member(user_id)
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_weather_cache.trip_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users delete own weather data" ON public.trip_weather_cache;
CREATE POLICY "Users delete own weather data"
  ON public.trip_weather_cache
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_family_member(user_id)
    OR EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_weather_cache.trip_id
        AND tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_weather_cache_trip ON public.trip_weather_cache(trip_id);
CREATE INDEX IF NOT EXISTS idx_weather_cache_user ON public.trip_weather_cache(user_id);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS temperature_unit text
  CHECK (temperature_unit IN ('fahrenheit', 'celsius'))
  DEFAULT 'fahrenheit';

CREATE OR REPLACE FUNCTION public.touch_weather_cache_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trip_weather_cache_updated_at ON public.trip_weather_cache;
CREATE TRIGGER trg_trip_weather_cache_updated_at
BEFORE UPDATE ON public.trip_weather_cache
FOR EACH ROW
EXECUTE FUNCTION public.touch_weather_cache_updated_at();

CREATE OR REPLACE FUNCTION public.clear_trip_weather_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.trip_weather_cache
  WHERE trip_id = COALESCE(NEW.trip_id, OLD.trip_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_trip_weather_cache_bust ON public.trip_items;
CREATE TRIGGER trg_trip_weather_cache_bust
AFTER INSERT OR UPDATE OR DELETE ON public.trip_items
FOR EACH ROW
EXECUTE FUNCTION public.clear_trip_weather_cache();
