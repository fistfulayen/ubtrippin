-- Clean tracked_cities: remove venues/restaurants/airports/hotels that got
-- promoted to city-level entities. Fix real cities missing country data.
-- QA bug: /cities page polluted with non-city entries (2026-03-28).

-- Step 1: Delete events attached to non-city entries (Skuna boat, Sky Lagoon)
-- These are venue-level entries that shouldn't exist as cities.
DELETE FROM city_events WHERE city_id IN (
  SELECT id FROM tracked_cities WHERE city IN (
    'Skuna boat', 'Sky Lagoon'
  )
);

-- Step 2: Delete junk entries (venues, restaurants, hotels, airports, museums)
DELETE FROM tracked_cities WHERE city IN (
  'Apotek Kitchen  Bar',
  'Aurora Museum',
  'Autograph Collection',
  'Dishoom Carnaby',
  'Gielgud Theatre',
  'Ginette  La Folie',
  'Grillmarkadurin',
  'Harry Potter Studio Tour',
  'Imperial Treasure',
  'Keflavik International',
  'Kopar Restaurant',
  'Kyoto University',
  'Lava Show Reykjavk',
  'Lava Show venue',
  'Osteria Angelina Spitalfields',
  'Padella Shoreditch',
  'Paradox Museum',
  'Pick and Cheese',
  'PST',
  'PST Higazabu',
  'San Jose International',
  'Skuna boat',
  'Sky Lagoon',
  'Soya',
  'The Reykjavik EDITION'
);

-- Step 3: Fix real cities missing country/country_code
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Buffalo' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Charleston' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Cleveland' AND country = '';
UPDATE tracked_cities SET country = 'Denmark', country_code = 'DK' WHERE city = 'Copenhagen' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Dallas' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Fort Lauderdale' AND country = '';
UPDATE tracked_cities SET country = 'Cayman Islands', country_code = 'KY' WHERE city = 'George Town' AND country = '';
UPDATE tracked_cities SET country = 'Japan', country_code = 'JP' WHERE city = 'Hokuto' AND country = '';
UPDATE tracked_cities SET country = 'Japan', country_code = 'JP' WHERE city = 'Kyoto' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Leesburg' AND country = '';
UPDATE tracked_cities SET country = 'Germany', country_code = 'DE' WHERE city = 'Munich' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Newark' AND country = '';
UPDATE tracked_cities SET country = 'France', country_code = 'FR' WHERE city = 'Nice' AND country = '';
UPDATE tracked_cities SET country = 'Czech Republic', country_code = 'CZ' WHERE city = 'Prague' AND country = '';
UPDATE tracked_cities SET country = 'Sint Maarten', country_code = 'SX' WHERE city = 'Saint Maarten' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'San Francisco' AND country = '';
UPDATE tracked_cities SET country = 'Chile', country_code = 'CL' WHERE city = 'Santiago' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Sarasota' AND country = '';
UPDATE tracked_cities SET country = 'South Korea', country_code = 'KR' WHERE city = 'Seoul' AND country = '';
UPDATE tracked_cities SET country = 'United States', country_code = 'US' WHERE city = 'Spokane' AND country = '';
UPDATE tracked_cities SET country = 'Japan', country_code = 'JP' WHERE city = 'Uji' AND country = '';
UPDATE tracked_cities SET country = 'Italy', country_code = 'IT' WHERE city = 'Venice' AND country = '';

-- Step 4: Add NOT NULL constraint on country to prevent future pollution.
-- Any future inserts must include a country.
ALTER TABLE tracked_cities ALTER COLUMN country SET NOT NULL;
ALTER TABLE tracked_cities ADD CONSTRAINT tracked_cities_country_not_empty CHECK (country <> '');
