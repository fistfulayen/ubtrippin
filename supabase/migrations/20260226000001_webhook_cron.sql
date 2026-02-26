-- Webhook delivery: two mechanisms for reliability
--
-- 1. DB trigger on queue insert → pg_net HTTP call to edge function (sub-second)
-- 2. pg_cron fallback every 1 minute (catches anything the trigger missed)
--
-- Requires: pg_net extension enabled in Supabase Dashboard.

create extension if not exists pg_net with schema extensions;

-- 1. Trigger: fire edge function on every queue insert for immediate delivery
create or replace function public.notify_webhook_delivery()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://cqijgtijuselspyzpphf.supabase.co/functions/v1/webhook-delivery-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  return new;
exception when others then
  -- Never block the insert if the HTTP call fails
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_webhook_queue_notify on public.webhook_delivery_queue;
create trigger trg_webhook_queue_notify
  after insert on public.webhook_delivery_queue
  for each row execute function public.notify_webhook_delivery();

-- 2. Fallback cron: every 1 minute, process any stragglers
-- Only create if pg_cron is available (paid Supabase plans)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('webhook-delivery-worker');
  end if;
exception when others then
  null; -- pg_cron not available, skip
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'webhook-delivery-worker',
      '* * * * *',
      $cron$
      select net.http_post(
        url := 'https://cqijgtijuselspyzpphf.supabase.co/functions/v1/webhook-delivery-worker',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  end if;
exception when others then
  null; -- pg_cron not available, skip
end;
$$;
