-- Fix: Enable RLS on provider_catalog (was missing since creation in 20260225000006)
-- This is a read-only reference table (airlines, hotels, car rentals).
-- Anyone authenticated can read; no write access via API.

ALTER TABLE public.provider_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_catalog_public_read"
  ON public.provider_catalog
  FOR SELECT
  USING (true);
