-- Extraction Learning System
-- Enables few-shot learning from user corrections to improve AI extraction

-- Store examples for few-shot learning
create table public.extraction_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  source_email_id uuid references source_emails(id) on delete set null,

  email_subject text,
  email_body_snippet text not null,      -- Truncated/anonymized (~500 chars)
  attachment_text_snippet text,
  corrected_extraction jsonb not null,   -- The "right answer"

  provider_pattern text,                  -- e.g., "airfrance.com"
  item_kind text,                         -- e.g., "flight"
  is_global boolean default false,
  usage_count integer default 0,

  created_at timestamptz default now()
);

create index idx_examples_provider on extraction_examples(provider_pattern);
create index idx_examples_global on extraction_examples(is_global) where is_global = true;

-- Track individual corrections for analytics
create table public.extraction_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source_email_id uuid not null references source_emails(id) on delete cascade,

  field_path text not null,               -- e.g., 'items[0].confirmation_code'
  original_value jsonb,
  corrected_value jsonb not null,
  correction_type text not null check (correction_type in ('added', 'modified', 'removed')),

  created_at timestamptz default now()
);

create index idx_corrections_email on extraction_corrections(source_email_id);
create index idx_corrections_user on extraction_corrections(user_id);

-- Add attachment_text column to source_emails for storing extracted PDF text
alter table source_emails add column if not exists attachment_text text;

-- Enable RLS on new tables
alter table extraction_examples enable row level security;
alter table extraction_corrections enable row level security;

-- RLS policies for extraction_examples
create policy "Users view own + global examples" on extraction_examples
  for select using (auth.uid() = user_id or is_global = true);
create policy "Users insert own examples" on extraction_examples
  for insert with check (auth.uid() = user_id);
create policy "Users update own examples" on extraction_examples
  for update using (auth.uid() = user_id);
create policy "Users delete own examples" on extraction_examples
  for delete using (auth.uid() = user_id);

-- RLS policies for extraction_corrections
create policy "Users manage own corrections" on extraction_corrections
  for all using (auth.uid() = user_id);

-- Function to increment usage count for selected examples
create or replace function public.increment_example_usage(example_ids uuid[])
returns void
language plpgsql
security definer
as $$
begin
  update extraction_examples
  set usage_count = usage_count + 1
  where id = any(example_ids);
end;
$$;
