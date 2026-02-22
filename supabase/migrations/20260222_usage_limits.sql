-- Usage Limits Migration
-- Adds subscription_tier to profiles and monthly_extractions tracking table

-- Add subscription_tier column to profiles
alter table public.profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro'));

-- Monthly extraction count tracking
create table if not exists public.monthly_extractions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month   text not null,  -- YYYY-MM format
  count   integer not null default 0,
  primary key (user_id, month)
);

-- Enable RLS
alter table public.monthly_extractions enable row level security;

-- Service role can read/write (webhooks use service key)
-- Users can view their own extraction counts
create policy "Users can view own extraction counts"
  on public.monthly_extractions for select
  using (auth.uid() = user_id);

-- Index for fast monthly lookups
create index if not exists idx_monthly_extractions_user_month
  on public.monthly_extractions(user_id, month);
