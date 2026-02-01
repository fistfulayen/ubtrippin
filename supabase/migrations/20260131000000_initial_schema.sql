-- UBTRIPPIN.XYZ Initial Schema
-- Enable required extensions
create extension if not exists citext;

-- Users profile (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Allowed sender emails (users add their OWN email addresses here)
create table public.allowed_senders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email citext not null,
  label text, -- e.g., "Personal Gmail", "Work Email"
  verified boolean default false,
  created_at timestamptz default now(),
  unique(user_id, email)
);

-- Source emails (raw inbound data) - created before trip_items for foreign key
create table public.source_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  from_email text not null,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  received_at timestamptz default now(),
  resend_message_id text unique,
  raw_storage_path text,
  attachments_json jsonb default '[]',
  parse_status text default 'pending' check (parse_status in ('pending', 'processing', 'completed', 'failed', 'unassigned')),
  parse_error text,
  extracted_json jsonb,
  auth_results jsonb, -- SPF/DKIM/DMARC from Resend
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trips (the core object)
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  start_date date,
  end_date date,
  primary_location text,
  travelers text[] default '{}',
  notes text,
  cover_image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trip items (reservations)
create table public.trip_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  kind text not null check (kind in ('flight', 'hotel', 'train', 'car', 'restaurant', 'activity', 'other')),
  provider text,
  confirmation_code text,
  traveler_names text[] default '{}',
  start_ts timestamptz,
  end_ts timestamptz,
  start_date date not null,
  end_date date,
  start_location text,
  end_location text,
  summary text,
  details_json jsonb default '{}',
  status text default 'confirmed' check (status in ('confirmed', 'cancelled', 'changed', 'pending', 'unknown')),
  confidence numeric(3,2) default 1.0,
  needs_review boolean default false,
  source_email_id uuid references public.source_emails(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Audit log for changes
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null, -- 'trip', 'trip_item'
  entity_id uuid not null,
  action text not null, -- 'create', 'update', 'delete', 'merge', 'move'
  changes_json jsonb,
  created_at timestamptz default now()
);

-- Generated PDFs storage reference
create table public.trip_pdfs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  generated_at timestamptz default now()
);

-- Indexes
create index idx_allowed_senders_email on public.allowed_senders(email);
create index idx_trips_user_dates on public.trips(user_id, start_date, end_date);
create index idx_trip_items_trip on public.trip_items(trip_id);
create index idx_trip_items_user on public.trip_items(user_id);
create index idx_source_emails_from on public.source_emails(from_email);
create index idx_source_emails_user on public.source_emails(user_id);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.allowed_senders enable row level security;
alter table public.trips enable row level security;
alter table public.trip_items enable row level security;
alter table public.source_emails enable row level security;
alter table public.audit_logs enable row level security;
alter table public.trip_pdfs enable row level security;

-- Profiles: users can only see/edit their own
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Allowed senders: users manage their own
create policy "Users can manage own allowed senders"
  on public.allowed_senders for all using (auth.uid() = user_id);

-- Trips: users see/manage their own
create policy "Users can manage own trips"
  on public.trips for all using (auth.uid() = user_id);

-- Trip items: users see/manage their own
create policy "Users can manage own trip items"
  on public.trip_items for all using (auth.uid() = user_id);

-- Source emails: users see their own + service role can insert/update
create policy "Users can view own emails"
  on public.source_emails for select using (auth.uid() = user_id);
create policy "Users can delete own emails"
  on public.source_emails for delete using (auth.uid() = user_id);

-- Audit logs: users can view their own
create policy "Users can view own audit logs"
  on public.audit_logs for select using (auth.uid() = user_id);

-- Trip PDFs: users manage their own
create policy "Users can manage own PDFs"
  on public.trip_pdfs for all using (auth.uid() = user_id);

-- Function to handle new user signup and create profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers for updated_at on relevant tables
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

create trigger update_trips_updated_at
  before update on public.trips
  for each row execute procedure public.update_updated_at_column();

create trigger update_trip_items_updated_at
  before update on public.trip_items
  for each row execute procedure public.update_updated_at_column();

create trigger update_source_emails_updated_at
  before update on public.source_emails
  for each row execute procedure public.update_updated_at_column();

-- Storage buckets (run these in Supabase Dashboard or via API)
-- insert into storage.buckets (id, name, public) values ('raw-emails', 'raw-emails', false);
-- insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false);
