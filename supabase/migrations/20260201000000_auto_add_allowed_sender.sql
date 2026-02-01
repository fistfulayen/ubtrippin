-- Update trigger to auto-add user's email as allowed sender on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Create profile
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );

  -- Auto-add their email as allowed sender
  insert into public.allowed_senders (user_id, email, label, verified)
  values (
    new.id,
    new.email,
    'Primary Email',
    true
  );

  return new;
end;
$$;

-- Fix existing users (adds allowed sender for all profiles that don't have one)
insert into allowed_senders (user_id, email, label, verified)
select p.id, p.email, 'Primary Email', true
from profiles p
where not exists (
  select 1 from allowed_senders a where a.user_id = p.id and a.email = p.email
);
