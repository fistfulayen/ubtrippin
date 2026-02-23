alter table public.profiles
  add column if not exists welcome_email_sent boolean not null default false,
  add column if not exists onboarding_completed boolean not null default false;
