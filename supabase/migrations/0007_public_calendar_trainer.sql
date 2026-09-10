create or replace view public.public_calendar
with (security_invoker = off) as
select
  s.id,
  'slot'::text as kind,
  s.location_id,
  s.starts_at,
  s.ends_at,
  s.status,
  case when s.status = 'booked'
    then (select left(b.first_name,1) || '.' from public.bookings b
          where b.slot_id = s.id and b.status <> 'cancelled'
          order by b.created_at desc limit 1)
  end as initial,
  case when s.status = 'booked'
    then (select b.dance_type from public.bookings b
          where b.slot_id = s.id and b.status <> 'cancelled'
          order by b.created_at desc limit 1)
  end as dance_type,
  s.trainer_id
from public.slots s
where s.status in ('open','booked');

grant select on public.public_calendar to anon, authenticated;
