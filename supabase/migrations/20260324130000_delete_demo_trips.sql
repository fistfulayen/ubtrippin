-- PRD-054: Remove demo trips from user accounts
-- Demo trips caused confusion with real travel data.
-- The /trips/demo showcase page remains for reference.

-- Delete demo trip items first (FK constraint)
DELETE FROM trip_items
WHERE trip_id IN (SELECT id FROM trips WHERE is_demo = true);

-- Delete demo trips
DELETE FROM trips WHERE is_demo = true;

-- Note: is_demo column kept for backward compatibility.
-- Drop in a future migration after confirming no code references it.
