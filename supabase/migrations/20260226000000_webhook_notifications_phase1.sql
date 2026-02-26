-- PRD 013 Phase 1 — Webhook Notifications

create table if not exists public.webhooks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  url              text not null,
  description      text,
  secret_encrypted text not null,
  secret_masked    text not null,
  events           text[] not null default '{}'::text[],
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_webhooks_user on public.webhooks(user_id);
create index if not exists idx_webhooks_user_enabled on public.webhooks(user_id, enabled);

drop trigger if exists update_webhooks_updated_at on public.webhooks;
create trigger update_webhooks_updated_at
  before update on public.webhooks
  for each row execute function public.update_updated_at_column();

create table if not exists public.webhook_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  webhook_id         uuid not null references public.webhooks(id) on delete cascade,
  event              text not null,
  payload            jsonb not null,
  status             text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  attempts           integer not null default 0 check (attempts >= 0 and attempts <= 4),
  last_attempt_at    timestamptz,
  last_response_code integer,
  last_response_body text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_webhook_created
  on public.webhook_deliveries(webhook_id, created_at desc);
create index if not exists idx_webhook_deliveries_status_created
  on public.webhook_deliveries(status, created_at desc);

create table if not exists public.webhook_delivery_queue (
  id            uuid primary key default gen_random_uuid(),
  webhook_id    uuid not null references public.webhooks(id) on delete cascade,
  delivery_id   uuid not null references public.webhook_deliveries(id) on delete cascade,
  attempt       integer not null check (attempt >= 1 and attempt <= 4),
  deliver_after timestamptz not null,
  created_at    timestamptz not null default now(),
  unique(delivery_id, attempt)
);

create index if not exists idx_webhook_delivery_queue_due
  on public.webhook_delivery_queue(deliver_after asc);
create index if not exists idx_webhook_delivery_queue_webhook_due
  on public.webhook_delivery_queue(webhook_id, deliver_after asc);

alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.webhook_delivery_queue enable row level security;

drop policy if exists "webhooks_self" on public.webhooks;
create policy "webhooks_self" on public.webhooks
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "webhook_deliveries_self" on public.webhook_deliveries;
create policy "webhook_deliveries_self" on public.webhook_deliveries
  for select using (
    exists (
      select 1
      from public.webhooks w
      where w.id = webhook_deliveries.webhook_id
        and w.user_id = auth.uid()
    )
  );

-- queue is service-role only (RLS enabled, no user policy)
