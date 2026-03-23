CREATE TABLE IF NOT EXISTS public.token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  source_email_id UUID,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  extraction_type TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY token_usage_select ON public.token_usage FOR SELECT USING (true);
CREATE INDEX idx_token_usage_created_at ON public.token_usage (created_at DESC);
CREATE INDEX idx_token_usage_user_id ON public.token_usage (user_id);
