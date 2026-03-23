-- Affiliate program tables
-- Affiliates are distinct from the referral system (user-to-user referrals).
-- Affiliates are external partners/creators who earn commission on conversions.

CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  affiliate_code TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'standard' CHECK (tier IN ('standard', 'partner', 'ambassador')),
  payout_email TEXT,
  payout_method TEXT DEFAULT 'stripe_connect' CHECK (payout_method IN ('stripe_connect', 'paypal')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  total_conversions INT DEFAULT 0,
  total_earned_cents INT DEFAULT 0,
  total_paid_cents INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES public.affiliates(id),
  subscriber_id UUID REFERENCES auth.users(id),
  commission_cents INT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY affiliates_own ON public.affiliates FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY affiliates_insert ON public.affiliates FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY affiliate_conversions_own ON public.affiliate_conversions FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = (SELECT auth.uid())));

CREATE INDEX idx_affiliates_code ON public.affiliates (affiliate_code);
CREATE INDEX idx_affiliate_conversions_affiliate ON public.affiliate_conversions (affiliate_id);
