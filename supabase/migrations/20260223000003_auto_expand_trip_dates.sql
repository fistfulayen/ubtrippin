-- Auto-expand trip date range when items are added/moved/updated
-- This ensures trip start_date/end_date always covers all items

create or replace function public.auto_expand_trip_dates()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  item_start date;
  item_end date;
  trip_start date;
  trip_end date;
begin
  -- Determine the trip_id to update
  -- On INSERT/UPDATE use NEW, on DELETE use OLD
  declare
    target_trip_id uuid;
    old_trip_id uuid;
  begin
    if TG_OP = 'DELETE' then
      target_trip_id := old.trip_id;
      old_trip_id := null;
    else
      target_trip_id := new.trip_id;
      old_trip_id := case when TG_OP = 'UPDATE' then old.trip_id else null end;
    end if;

    -- Skip if no trip assigned
    if target_trip_id is null and old_trip_id is null then
      if TG_OP = 'DELETE' then return old; else return new; end if;
    end if;

    -- Update the target trip (where item was moved TO or inserted)
    if target_trip_id is not null then
      select min(ti.start_date), max(coalesce(ti.end_date, ti.start_date))
      into item_start, item_end
      from public.trip_items ti
      where ti.trip_id = target_trip_id
        and ti.start_date is not null;

      if item_start is not null then
        select t.start_date, t.end_date
        into trip_start, trip_end
        from public.trips t
        where t.id = target_trip_id;

        if item_start < trip_start or item_end > coalesce(trip_end, trip_start) then
          update public.trips
          set start_date = least(trip_start, item_start),
              end_date = greatest(coalesce(trip_end, trip_start), item_end),
              updated_at = now()
          where id = target_trip_id;
        end if;
      end if;
    end if;

    -- If item was MOVED from another trip, shrink that trip's dates
    if old_trip_id is not null and old_trip_id is distinct from target_trip_id then
      select min(ti.start_date), max(coalesce(ti.end_date, ti.start_date))
      into item_start, item_end
      from public.trip_items ti
      where ti.trip_id = old_trip_id
        and ti.start_date is not null;

      if item_start is not null then
        update public.trips
        set start_date = item_start,
            end_date = item_end,
            updated_at = now()
        where id = old_trip_id;
      end if;
    end if;

    if TG_OP = 'DELETE' then return old; else return new; end if;
  end;
end;
$$;

-- Fire after insert, update, or delete on trip_items
drop trigger if exists auto_expand_trip_dates_trigger on public.trip_items;
create trigger auto_expand_trip_dates_trigger
  after insert or update or delete on public.trip_items
  for each row execute procedure public.auto_expand_trip_dates();
