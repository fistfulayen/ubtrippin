-- Sync Google avatars: backfill from auth.users metadata + keep updated on sign-in

-- 1. Backfill existing users' avatars from auth.users metadata
update public.profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data ->> 'avatar_url',
  u.raw_user_meta_data ->> 'picture'
)
from auth.users u
where p.id = u.id
and p.avatar_url is null
and (u.raw_user_meta_data ->> 'avatar_url' is not null
  or u.raw_user_meta_data ->> 'picture' is not null);

-- 2. Create a function that syncs avatar on every sign-in
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  new_avatar text;
begin
  new_avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  );

  if new_avatar is not null then
    update public.profiles
    set avatar_url = new_avatar,
        full_name = coalesce(new.raw_user_meta_data ->> 'full_name', full_name),
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

-- 3. Trigger on auth.users UPDATE (fires on every sign-in when metadata refreshes)
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute procedure public.handle_user_updated();
