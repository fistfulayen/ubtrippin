alter table public.profiles add column if not exists stripe_customer_id text unique;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists subscription_current_period_end timestamptz;
alter table public.profiles add column if not exists subscription_grace_until timestamptz;

create index if not exists idx_profiles_stripe_customer on public.profiles(stripe_customer_id);
create index if not exists idx_profiles_stripe_subscription on public.profiles(stripe_subscription_id);

-- Returns global Pro/grace subscriber count for early-adopter gating.
-- SECURITY DEFINER is used to expose only an aggregate number while keeping profile RLS intact.
create or replace function public.billing_pro_subscriber_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles
  where subscription_tier in ('pro', 'grace');
$$;

revoke all on function public.billing_pro_subscriber_count() from public;
grant execute on function public.billing_pro_subscriber_count() to anon;
grant execute on function public.billing_pro_subscriber_count() to authenticated;
