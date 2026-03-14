-- PRD-042: Extended flight status fields from FlightAware
-- These columns store richer flight data for the redesigned flight card
alter table public.trip_item_status
  add column if not exists aircraft_type text,
  add column if not exists tail_number text,
  add column if not exists inbound_fa_flight_id text,
  add column if not exists inbound_origin text,
  add column if not exists inbound_ident text,
  add column if not exists inbound_estimated_in timestamptz,
  add column if not exists operator text,
  add column if not exists operator_iata text,
  add column if not exists codeshares text[],
  add column if not exists baggage_claim text,
  add column if not exists arrival_gate text,
  add column if not exists arrival_terminal text,
  add column if not exists departure_gate text,
  add column if not exists departure_terminal text,
  add column if not exists actual_off timestamptz,
  add column if not exists actual_on timestamptz,
  add column if not exists actual_out timestamptz,
  add column if not exists actual_in timestamptz;
