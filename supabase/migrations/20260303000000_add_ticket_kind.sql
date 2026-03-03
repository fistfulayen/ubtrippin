-- Add 'ticket' to the allowed values for trip_items.kind
-- Required for PRD-031 (Event Ticket Forwarding)
ALTER TABLE trip_items DROP CONSTRAINT IF EXISTS trip_items_kind_check;
ALTER TABLE trip_items ADD CONSTRAINT trip_items_kind_check 
  CHECK (kind IN ('flight', 'hotel', 'train', 'car', 'restaurant', 'activity', 'ticket', 'other'));
