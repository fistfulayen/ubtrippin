create or replace function public.set_request_user(user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

revoke all on function public.set_request_user(uuid) from public;
grant execute on function public.set_request_user(uuid) to service_role;
