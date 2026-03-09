CREATE TABLE IF NOT EXISTS tracked_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code TEXT,
  slug TEXT UNIQUE NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  timezone TEXT,
  hero_image_url TEXT,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city, country)
);

ALTER TABLE tracked_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON tracked_cities
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS tracked_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES tracked_cities(id) ON DELETE CASCADE,
  google_place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  venue_type TEXT,
  tier INTEGER DEFAULT 50,
  photo_url TEXT,
  maps_url TEXT,
  added_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tracked_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON tracked_venues
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS city_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES tracked_cities(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES tracked_venues(id),
  parent_event_id UUID REFERENCES city_events(id),
  title TEXT NOT NULL,
  venue_name TEXT,
  venue_type TEXT,
  category TEXT DEFAULT 'other',
  event_tier TEXT NOT NULL DEFAULT 'medium',
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  time_info TEXT,
  significance_score INTEGER DEFAULT 50,
  source TEXT,
  source_url TEXT,
  image_url TEXT,
  price_info TEXT,
  booking_url TEXT,
  tags TEXT[],
  lineup JSONB,
  last_verified_at TIMESTAMPTZ,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE city_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON city_events
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_city_events_city_dates ON city_events(city_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_city_events_tier ON city_events(event_tier);
CREATE INDEX IF NOT EXISTS idx_city_events_parent_event_id ON city_events(parent_event_id);

CREATE TABLE IF NOT EXISTS city_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES tracked_cities(id) ON DELETE CASCADE,
  source_type TEXT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  scrape_frequency TEXT DEFAULT 'weekly',
  status TEXT DEFAULT 'candidate',
  consecutive_failures INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  last_event_count INTEGER DEFAULT 0,
  discovered_via TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE city_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON city_sources
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS event_pipeline_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES tracked_cities(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  diary_text TEXT NOT NULL,
  run_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_day_plan JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, run_date)
);

ALTER TABLE event_pipeline_diary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON event_pipeline_diary
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS event_source_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES tracked_cities(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT,
  run_date DATE NOT NULL,
  status TEXT NOT NULL,
  events_found INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_source_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON event_source_reports
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS event_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  city_id UUID REFERENCES tracked_cities(id),
  feedback_type TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  sanitized_text TEXT,
  extracted_urls TEXT[],
  extracted_event JSONB,
  status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON event_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own feedback" ON event_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_event_interests (
  user_id UUID REFERENCES auth.users(id),
  event_id UUID REFERENCES city_events(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(user_id, event_id)
);

ALTER TABLE user_event_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own interests" ON user_event_interests
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO tracked_cities (city, country, country_code, slug, latitude, longitude, timezone) VALUES
  ('Paris', 'France', 'FR', 'paris', 48.8566, 2.3522, 'Europe/Paris'),
  ('New York', 'United States', 'US', 'new-york', 40.7128, -74.0060, 'America/New_York'),
  ('London', 'United Kingdom', 'GB', 'london', 51.5074, -0.1278, 'Europe/London'),
  ('Tallinn', 'Estonia', 'EE', 'tallinn', 59.4370, 24.7536, 'Europe/Tallinn'),
  ('Tokyo', 'Japan', 'JP', 'tokyo', 35.6762, 139.6503, 'Asia/Tokyo'),
  ('Miami', 'United States', 'US', 'miami', 25.7617, -80.1918, 'America/New_York'),
  ('Austin', 'United States', 'US', 'austin', 30.2672, -97.7431, 'America/Chicago'),
  ('Turin', 'Italy', 'IT', 'turin', 45.0703, 7.6869, 'Europe/Rome'),
  ('Florence', 'Italy', 'IT', 'florence', 43.7696, 11.2558, 'Europe/Rome'),
  ('Lucca', 'Italy', 'IT', 'lucca', 43.8429, 10.5027, 'Europe/Rome'),
  ('Rome', 'Italy', 'IT', 'rome', 41.9028, 12.4964, 'Europe/Rome'),
  ('Milan', 'Italy', 'IT', 'milan', 45.4642, 9.1900, 'Europe/Rome'),
  ('Barcelona', 'Spain', 'ES', 'barcelona', 41.3874, 2.1686, 'Europe/Madrid'),
  ('Amsterdam', 'Netherlands', 'NL', 'amsterdam', 52.3676, 4.9041, 'Europe/Amsterdam'),
  ('Berlin', 'Germany', 'DE', 'berlin', 52.5200, 13.4050, 'Europe/Berlin')
ON CONFLICT DO NOTHING;
