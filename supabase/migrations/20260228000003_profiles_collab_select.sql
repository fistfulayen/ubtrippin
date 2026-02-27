-- Allow authenticated users to view the profile of trip owners
-- whose trips they actively collaborate on. This supports the "Shared by ..."
-- label in the trips list without a service-role bypass.
--
-- Postgres RLS permissive policies are OR-ed, so this extends (not replaces)
-- the existing "Users can view own profile" policy.

create policy "profiles_collab_read"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.trips t
      join public.trip_collaborators tc on tc.trip_id = t.id
      where t.user_id = profiles.id
        and tc.user_id = auth.uid()
        and tc.accepted_at is not null
    )
  );
