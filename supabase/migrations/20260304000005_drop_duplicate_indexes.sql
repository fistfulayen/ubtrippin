-- PRD-033 P3B: Drop duplicate indexes shadowed by unique constraints.

DROP INDEX IF EXISTS public.idx_trip_item_status_item;
DROP INDEX IF EXISTS public.idx_profiles_stripe_customer;
DROP INDEX IF EXISTS public.idx_api_keys_hash;
