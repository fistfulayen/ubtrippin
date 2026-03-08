-- Allow anonymous read access to explicitly shared trips/items using the share token header.

create policy "trips_public_share_select" on public.trips
  for select
  using (
    share_enabled = true
    and share_token is not null
    and share_token = (
      coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-share-token'
    )
  );

create policy "trip_items_public_share_select" on public.trip_items
  for select
  using (
    exists (
      select 1
      from public.trips t
      where t.id = trip_items.trip_id
        and t.share_enabled = true
        and t.share_token is not null
        and t.share_token = (
          coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-share-token'
        )
    )
  );
