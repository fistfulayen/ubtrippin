-- Outgoing Partner API integration: adds H3 cell cache, event source flag, and shelf storage.

-- H3 cell is a geographic property of the city's coordinates (not Outgoing-specific).
ALTER TABLE tracked_cities ADD COLUMN IF NOT EXISTS h3_cell TEXT;

-- Flag which pipeline powers this city: 'legacy' (Brave/RSS) or 'outgoing'.
ALTER TABLE tracked_cities ADD COLUMN IF NOT EXISTS event_source TEXT NOT NULL DEFAULT 'legacy';

-- Shelf structure cache: persists themed groupings from the Outgoing homescreen API.
CREATE TABLE IF NOT EXISTS outgoing_shelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES tracked_cities(id) ON DELETE CASCADE NOT NULL,
  shelf_slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  activity_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, shelf_slug)
);

ALTER TABLE outgoing_shelves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON outgoing_shelves
  FOR SELECT USING (true);

CREATE INDEX idx_outgoing_shelves_city ON outgoing_shelves(city_id);

-- Fast lookups for Outgoing-sourced events (used during refresh delete + shelf rendering).
CREATE INDEX idx_city_events_source_outgoing ON city_events(source) WHERE source = 'outgoing';

-- Mark cities supported by Outgoing.
UPDATE tracked_cities SET event_source = 'outgoing'
WHERE slug IN ('paris', 'new-york', 'tokyo', 'barcelona', 'berlin', 'amsterdam');
