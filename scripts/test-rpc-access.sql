-- Run inside a transaction after the RPC access migration. No business writes.
DO $$
DECLARE r record; unrelated uuid := gen_random_uuid();
BEGIN
  IF has_function_privilege('anon','public.increment_example_usage(uuid[])','EXECUTE')
     OR has_function_privilege('authenticated','public.increment_example_usage(uuid[])','EXECUTE')
     OR NOT has_function_privilege('service_role','public.increment_example_usage(uuid[])','EXECUTE')
     OR has_function_privilege('anon','public.trip_owner_user_id(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC grants violate intended access';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trips) THEN RAISE EXCEPTION 'No trip available for access verification'; END IF;
  FOR r IN SELECT id,user_id FROM public.trips LIMIT 8 LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r.user_id,'role','authenticated')::text,true);
    IF public.trip_owner_user_id(r.id) IS DISTINCT FROM r.user_id THEN RAISE EXCEPTION 'Owner access regressed'; END IF;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',unrelated,'role','authenticated')::text,true);
    IF public.trip_owner_user_id(r.id) IS NOT NULL THEN RAISE EXCEPTION 'Unrelated account can resolve owner'; END IF;
    PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
    IF public.trip_owner_user_id(r.id) IS DISTINCT FROM r.user_id THEN RAISE EXCEPTION 'Server access regressed'; END IF;
  END LOOP;
  FOR r IN SELECT t.id,t.user_id,tc.user_id AS viewer FROM public.trips t JOIN public.trip_collaborators tc ON tc.trip_id=t.id WHERE tc.accepted_at IS NOT NULL LIMIT 8 LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r.viewer,'role','authenticated')::text,true);
    IF public.trip_owner_user_id(r.id) IS DISTINCT FROM r.user_id THEN RAISE EXCEPTION 'Accepted collaborator access regressed'; END IF;
  END LOOP;
  FOR r IN SELECT t.id,t.user_id,b.user_id AS viewer FROM public.trips t JOIN public.family_members a ON a.user_id=t.user_id JOIN public.family_members b ON a.family_id=b.family_id WHERE a.accepted_at IS NOT NULL AND b.accepted_at IS NOT NULL AND a.user_id<>b.user_id LIMIT 8 LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r.viewer,'role','authenticated')::text,true);
    IF public.trip_owner_user_id(r.id) IS DISTINCT FROM r.user_id THEN RAISE EXCEPTION 'Accepted family access regressed'; END IF;
  END LOOP;
END $$;
