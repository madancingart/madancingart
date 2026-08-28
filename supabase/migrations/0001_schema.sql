-- ===== TABELE =====

create table public.locations (
  id text primary key,
  name text not null,
  address text not null,
  maps_url text
);

create table public.class_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  is_pair boolean not null default false,
  color text not null default '#C9962E'
);

create table public.recurring_classes (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id),
  class_type_id uuid not null references public.class_types(id),
  weekday int not null check (weekday between 1 and 7), -- 1=poniedziałek
  start_time time not null,
  duration_min int not null,
  level text,
  capacity int not null default 12,
  signup_open boolean not null default true,
  active boolean not null default true
);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open','booked','blocked')),
  admin_note text,
  created_at timestamptz not null default now(),
  constraint slots_time_valid check (ends_at > starts_at)
);

create index slots_location_time on public.slots (location_id, starts_at);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  location_id text references public.locations(id),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int,
  signup_open boolean not null default true,
  published boolean not null default true
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('slot','class','event')),
  slot_id uuid references public.slots(id),
  recurring_class_id uuid references public.recurring_classes(id),
  event_id uuid references public.events(id),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  message text,
  dance_type text,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  payment_option text not null default 'onsite' check (payment_option in ('onsite','reservation','full')),
  payment_status text not null default 'not_required' check (payment_status in ('not_required','pending','paid','refunded')),
  stripe_checkout_session_id text,
  amount_cents int,
  consent_rodo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint bookings_target check (
    (kind='slot'  and slot_id is not null and recurring_class_id is null and event_id is null) or
    (kind='class' and recurring_class_id is not null and slot_id is null and event_id is null) or
    (kind='event' and event_id is not null and slot_id is null and recurring_class_id is null)
  ),
  constraint bookings_consent check (consent_rodo = true)
);

create index bookings_created on public.bookings (created_at desc);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ===== RLS =====

alter table public.locations enable row level security;
alter table public.class_types enable row level security;
alter table public.recurring_classes enable row level security;
alter table public.slots enable row level security;
alter table public.events enable row level security;
alter table public.bookings enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- publiczne odczyty (bez danych osobowych)
create policy "public read locations" on public.locations for select using (true);
create policy "public read class_types" on public.class_types for select using (true);
create policy "public read recurring" on public.recurring_classes for select using (active = true);
create policy "public read events" on public.events for select using (published = true);

-- slots: BEZ publicznej policy — anon widzi sloty wyłącznie przez widok public_calendar
-- (bezpośredni select na slots ujawniłby kolumnę admin_note; RLS jest wierszowe, nie kolumnowe)

-- bookings: ZERO dostępu publicznego (brak policy dla anon = deny)
create policy "admin all bookings" on public.bookings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all slots" on public.slots for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all recurring" on public.recurring_classes for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all events" on public.events for all using (public.is_admin()) with check (public.is_admin());
create policy "admin read admins" on public.admins for select using (public.is_admin());

-- ===== WIDOK PUBLICZNEGO KALENDARZA (anonimizacja w bazie) =====
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
  end as dance_type
from public.slots s
where s.status in ('open','booked');

grant select on public.public_calendar to anon, authenticated;

-- liczba zapisów na grupę (do pokazywania „ostatnie miejsca" bez ujawniania kto)
create or replace view public.class_occupancy
with (security_invoker = off) as
select rc.id as recurring_class_id,
       count(b.id) filter (where b.status <> 'cancelled') as taken,
       rc.capacity
from public.recurring_classes rc
left join public.bookings b on b.recurring_class_id = rc.id
group by rc.id, rc.capacity;

grant select on public.class_occupancy to anon, authenticated;

-- ===== RPC: bezpieczny zapis =====
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
    -- blokada doradcza: dwa równoległe zapisy na tę samą grupę nie przecisną się przez limit miejsc
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
    if not exists (select 1 from public.events where id = p_target_id and published and signup_open) then
      raise exception 'event_closed';
    end if;
    insert into public.bookings (kind, event_id, first_name, last_name, phone, email, message, payment_option, payment_status, consent_rodo)
    values ('event', p_target_id, trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)), p_message,
            coalesce(p_payment_option,'onsite'), case when coalesce(p_payment_option,'onsite')='onsite' then 'not_required' else 'pending' end, true)
    returning id into v_id;

  else
    raise exception 'invalid_kind';
  end if;

  return v_id;
end $$;

revoke all on function public.create_booking from public;
grant execute on function public.create_booking to anon, authenticated;
