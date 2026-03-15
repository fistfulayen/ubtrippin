CREATE TABLE public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_item_id TEXT,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.trip_items(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, provider_item_id)
);

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_history_owner" ON public.import_history
  FOR ALL USING (user_id = (SELECT auth.uid()));
