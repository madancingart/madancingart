-- RODO: możliwość wyczyszczenia PII przy zachowaniu wiersza (zajętość, status).
alter table public.bookings
  alter column last_name drop not null,
  alter column phone drop not null,
  alter column email drop not null;

create or replace function public.admin_anonymize_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  update public.bookings
    set
      first_name = 'Usunięto',
      last_name = null,
      phone = null,
      email = null,
      message = null
    where id = p_booking_id;

  if not found then
    raise exception 'booking_not_found';
  end if;
end
$$;

revoke all on function public.admin_anonymize_booking(uuid) from public;
grant execute on function public.admin_anonymize_booking(uuid) to authenticated;

-- Lista zapisów z lokalizacją i terminem (RLS z tabel źródłowych).
create or replace view public.admin_booking_list
with (security_invoker = true) as
select
  b.id,
  b.kind,
  b.slot_id,
  b.recurring_class_id,
  b.event_id,
  b.first_name,
  b.last_name,
  b.phone,
  b.email,
  b.status,
  b.payment_status,
  b.created_at,
  coalesce(s.location_id, rc.location_id, e.location_id) as location_id,
  s.starts_at as slot_starts_at,
  s.ends_at as slot_ends_at,
  e.starts_at as event_starts_at,
  e.ends_at as event_ends_at,
  e.title as event_title,
  rc.weekday as class_weekday,
  rc.start_time as class_start_time,
  rc.duration_min as class_duration_min,
  ct.name as class_name
from public.bookings b
left join public.slots s on s.id = b.slot_id
left join public.recurring_classes rc on rc.id = b.recurring_class_id
left join public.class_types ct on ct.id = rc.class_type_id
left join public.events e on e.id = b.event_id;

grant select on public.admin_booking_list to authenticated;

-- Limit miejsc na event (null = bez limitu).
create or replace function public.create_booking(
  p_kind text,
  p_target_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_message text,
  p_dance_type text,
  p_payment_option text,
  p_consent boolean
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare
  v_id uuid;
  v_occupancy record;
  v_event public.events%rowtype;
  v_taken int;
begin
  if not p_consent then raise exception 'consent_required'; end if;
  if p_first_name is null or length(trim(p_first_name)) < 2 then raise exception 'invalid_first_name'; end if;
  if p_last_name is null or length(trim(p_last_name)) < 2 then raise exception 'invalid_last_name'; end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if length(regexp_replace(p_phone,'\D','','g')) < 9 then raise exception 'invalid_phone'; end if;

  if p_kind = 'slot' then
    update public.slots set status = 'booked'
      where id = p_target_id and status = 'open';
    if not found then raise exception 'slot_unavailable'; end if;
    insert into public.bookings (kind, slot_id, first_name, last_name, phone, email, message, dance_type, payment_option, payment_status, consent_rodo)
    values ('slot', p_target_id, trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)), p_message, p_dance_type,
            coalesce(p_payment_option,'onsite'), case when coalesce(p_payment_option,'onsite')='onsite' then 'not_required' else 'pending' end, true)
    returning id into v_id;

  elsif p_kind = 'class' then
    perform pg_advisory_xact_lock(hashtext(p_target_id::text));
    select * into v_occupancy from public.class_occupancy where recurring_class_id = p_target_id;
    if not exists (select 1 from public.recurring_classes where id = p_target_id and active and signup_open) then
      raise exception 'class_closed';
    end if;
    if v_occupancy.taken >= v_occupancy.capacity then raise exception 'class_full'; end if;
    insert into public.bookings (kind, recurring_class_id, first_name, last_name, phone, email, message, payment_option, payment_status, consent_rodo)
    values ('class', p_target_id, trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)), p_message,
            coalesce(p_payment_option,'onsite'), case when coalesce(p_payment_option,'onsite')='onsite' then 'not_required' else 'pending' end, true)
    returning id into v_id;

  elsif p_kind = 'event' then
    perform pg_advisory_xact_lock(hashtext(p_target_id::text));
    select * into v_event from public.events where id = p_target_id;
    if not found or not v_event.published or not v_event.signup_open then
      raise exception 'event_closed';
    end if;
    if v_event.capacity is not null then
      select count(*) into v_taken
        from public.bookings
        where event_id = p_target_id and status <> 'cancelled';
      if v_taken >= v_event.capacity then raise exception 'event_full'; end if;
    end if;
    insert into public.bookings (kind, event_id, first_name, last_name, phone, email, message, payment_option, payment_status, consent_rodo)
    values ('event', p_target_id, trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)), p_message,
            coalesce(p_payment_option,'onsite'), case when coalesce(p_payment_option,'onsite')='onsite' then 'not_required' else 'pending' end, true)
    returning id into v_id;

  else
    raise exception 'invalid_kind';
  end if;

  return v_id;
end
$$;
