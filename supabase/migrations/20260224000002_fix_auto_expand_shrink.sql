-- Fix: auto-expand trigger should also SHRINK trip dates when items change
-- Previously it only expanded, never contracted — stale end_dates persisted

create or replace function public.auto_expand_trip_dates()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  item_start date;
  item_end date;
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

  -- Update the target trip: ALWAYS sync to actual item range (expand AND shrink)
  if target_trip_id is not null then
    select min(ti.start_date), max(coalesce(ti.end_date, ti.start_date))
    into item_start, item_end
    from public.trip_items ti
    where ti.trip_id = target_trip_id
      and ti.start_date is not null;

    if item_start is not null then
      update public.trips
      set start_date = item_start,
          end_date = item_end,
          updated_at = now()
      where id = target_trip_id
        and (start_date is distinct from item_start
          or end_date is distinct from item_end);
    end if;
  end if;

  -- If item was MOVED from another trip, shrink that trip's dates too
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
      where id = old_trip_id
        and (start_date is distinct from item_start
          or end_date is distinct from item_end);
    end if;
  end if;

  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Also fix any currently-wrong trip dates by syncing to actual item ranges
update public.trips t
set start_date = sub.min_start,
    end_date = sub.max_end,
    updated_at = now()
from (
  select trip_id,
         min(start_date) as min_start,
         max(coalesce(end_date, start_date)) as max_end
  from public.trip_items
  where start_date is not null
  group by trip_id
) sub
where t.id = sub.trip_id
  and (t.start_date is distinct from sub.min_start
    or t.end_date is distinct from sub.max_end);
