-- API Keys Migration
-- Stores SHA-256 hashed API keys for agent/external access to the REST API v1.
-- Plain-text keys are never stored — only the hash.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key_hash text not null unique,   -- SHA-256 hex digest of the raw key
  name text not null,              -- human-readable label, e.g. "My Agent"
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Fast lookup by hash (the only query pattern we need)
create index idx_api_keys_hash on public.api_keys(key_hash);
create index idx_api_keys_user on public.api_keys(user_id);

-- Enable RLS
alter table public.api_keys enable row level security;

-- Users can manage only their own keys
create policy "Users can manage own API keys"
  on public.api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can look up any key (for API auth middleware)
-- No explicit policy needed; service role bypasses RLS by default.
