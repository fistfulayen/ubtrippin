-- Fix: remove set_config('role') which fails inside SECURITY DEFINER
-- RLS policies use auth.uid() which reads from request.jwt.claims, not the role GUC
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
end;
$$;
