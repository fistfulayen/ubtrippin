-- PRD 012 Phase 1: Traveler Profile & Loyalty Vault

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seat_preference text CHECK (seat_preference IN ('window','aisle','middle','no_preference')) DEFAULT 'no_preference',
  meal_preference text CHECK (meal_preference IN ('standard','vegetarian','vegan','kosher','halal','gluten_free','no_preference')) DEFAULT 'no_preference',
  airline_alliance text CHECK (airline_alliance IN ('star_alliance','oneworld','skyteam','none')) DEFAULT 'none',
  hotel_brand_preference text DEFAULT NULL,
  home_airport text DEFAULT NULL,
  currency_preference text DEFAULT 'USD',
  notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_profiles_self" ON public.user_profiles;
CREATE POLICY "user_profiles_self" ON public.user_profiles FOR ALL USING (id = auth.uid());

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  traveler_name text NOT NULL,
  provider_type text CHECK (provider_type IN ('airline','hotel','car_rental','other')) NOT NULL,
  provider_name text NOT NULL,
  provider_key text NOT NULL,
  program_number_encrypted text NOT NULL,
  program_number_masked text NOT NULL,
  status_tier text DEFAULT NULL,
  preferred boolean DEFAULT false,
  notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_programs_self" ON public.loyalty_programs;
CREATE POLICY "loyalty_programs_self" ON public.loyalty_programs FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS loyalty_programs_user_id_idx ON public.loyalty_programs(user_id);
CREATE INDEX IF NOT EXISTS loyalty_programs_user_provider_idx ON public.loyalty_programs(user_id, provider_key);

CREATE TABLE IF NOT EXISTS public.provider_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text UNIQUE NOT NULL,
  provider_name text NOT NULL,
  provider_type text CHECK (provider_type IN ('airline','hotel','car_rental','other')) NOT NULL,
  alliance_group text DEFAULT 'none',
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.provider_catalog (provider_key, provider_name, provider_type, alliance_group) VALUES
('united','United MileagePlus','airline','star_alliance'),
('lufthansa','Lufthansa Miles & More','airline','star_alliance'),
('swiss','SWISS Miles & More','airline','star_alliance'),
('aircanada','Air Canada Aeroplan','airline','star_alliance'),
('singapore','Singapore Airlines KrisFlyer','airline','star_alliance'),
('ana','ANA Mileage Club','airline','star_alliance'),
('turkish','Turkish Airlines Miles&Smiles','airline','star_alliance'),
('tap','TAP Miles&Go','airline','star_alliance'),
('delta','Delta SkyMiles','airline','skyteam'),
('airfrance','Air France-KLM Flying Blue','airline','skyteam'),
('klm','Air France-KLM Flying Blue','airline','skyteam'),
('koreanair','Korean Air SKYPASS','airline','skyteam'),
('aeromexico','Aeromexico Club Premier','airline','skyteam'),
('alitalia','ITA Airways Volare','airline','skyteam'),
('aa','American Airlines AAdvantage','airline','oneworld'),
('ba','British Airways Executive Club','airline','oneworld'),
('iberia','Iberia Plus','airline','oneworld'),
('jal','Japan Airlines JAL Mileage Bank','airline','oneworld'),
('cathay','Cathay Pacific Asia Miles','airline','oneworld'),
('qantas','Qantas Frequent Flyer','airline','oneworld'),
('finnair','Finnair Plus','airline','oneworld'),
('emirates','Emirates Skywards','airline','none'),
('etihad','Etihad Guest','airline','none'),
('ryanair','Ryanair Choice','airline','none'),
('easyjet','easyJet Flight Club','airline','none'),
('marriott','Marriott Bonvoy','hotel','marriott_portfolio'),
('hilton','Hilton Honors','hotel','hilton_portfolio'),
('ihg','IHG One Rewards','hotel','ihg_portfolio'),
('hyatt','World of Hyatt','hotel','hyatt_portfolio'),
('accor','Accor ALL','hotel','none'),
('wyndham','Wyndham Rewards','hotel','none'),
('hertz','Hertz Gold Plus Rewards','car_rental','hertz_group'),
('avis','Avis Preferred','car_rental','avis_budget_group'),
('budget','Budget Fastbreak','car_rental','avis_budget_group'),
('enterprise','Enterprise Plus','car_rental','enterprise_holdings'),
('alamo','Alamo Insiders','car_rental','enterprise_holdings'),
('national','National Emerald Club','car_rental','enterprise_holdings'),
('sixt','Sixt Card','car_rental','none')
ON CONFLICT (provider_key) DO NOTHING;

ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS loyalty_flag jsonb DEFAULT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pg_function_is_visible(oid)) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_user_profiles_updated_at' AND tgrelid = 'public.user_profiles'::regclass
    ) THEN
      CREATE TRIGGER trg_user_profiles_updated_at
      BEFORE UPDATE ON public.user_profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_loyalty_programs_updated_at' AND tgrelid = 'public.loyalty_programs'::regclass
    ) THEN
      CREATE TRIGGER trg_loyalty_programs_updated_at
      BEFORE UPDATE ON public.loyalty_programs
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
  ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pg_function_is_visible(oid)) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_user_profiles_updated_at' AND tgrelid = 'public.user_profiles'::regclass
    ) THEN
      CREATE TRIGGER trg_user_profiles_updated_at
      BEFORE UPDATE ON public.user_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_loyalty_programs_updated_at' AND tgrelid = 'public.loyalty_programs'::regclass
    ) THEN
      CREATE TRIGGER trg_loyalty_programs_updated_at
      BEFORE UPDATE ON public.loyalty_programs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END $$;
