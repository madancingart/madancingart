-- RODO: anonimizacja kartoteki klienta (PII w customers + bookings).
-- Pakiety zostają z kwotami i customer_id wskazującym na zanonimizowany wiersz.

create or replace function public.admin_anonymize_customer(p_customer_id uuid)
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
    where customer_id = p_customer_id;

  update public.customers
    set
      first_name = 'Usunięto',
      last_name = '',
      partner_first_name = null,
      partner_last_name = null,
      guardian_name = null,
      guardian_phone = null,
      phone = null,
      email = null,
      notes = null
    where id = p_customer_id;

  if not found then
    raise exception 'customer_not_found';
  end if;
end
$$;

revoke all on function public.admin_anonymize_customer(uuid) from public;
grant execute on function public.admin_anonymize_customer(uuid) to authenticated;

-- Lista zapisów: customer_id do linków kartoteki (kolumna na końcu — CREATE OR REPLACE).
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
  ct.name as class_name,
  b.customer_id
from public.bookings b
left join public.slots s on s.id = b.slot_id
left join public.recurring_classes rc on rc.id = b.recurring_class_id
left join public.class_types ct on ct.id = rc.class_type_id
left join public.events e on e.id = b.event_id;

grant select on public.admin_booking_list to authenticated;
