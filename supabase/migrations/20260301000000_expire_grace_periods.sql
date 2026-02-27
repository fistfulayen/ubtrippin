-- Downgrade expired grace-period subscriptions once per day.

create or replace function public.expire_billing_grace_periods()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_expired integer := 0;
begin
  update public.profiles
  set subscription_tier = 'free',
      subscription_grace_until = null
  where subscription_tier = 'grace'
    and subscription_grace_until is not null
    and subscription_grace_until < now();

  get diagnostics rows_expired = row_count;
  return rows_expired;
end;
$$;

revoke all on function public.expire_billing_grace_periods() from public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('billing-expire-grace-periods');
  end if;
exception when others then
  null; -- pg_cron not available, skip
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'billing-expire-grace-periods',
      '17 3 * * *',
      'select public.expire_billing_grace_periods();'
    );
  end if;
exception when others then
  null; -- pg_cron not available, skip
end;
$$;
