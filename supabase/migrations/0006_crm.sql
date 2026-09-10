-- ===== TRENERZY =====
create table public.trainers (
  id text primary key,
  name text not null,
  active boolean not null default true
);
insert into public.trainers (id, name) values
  ('ola','Aleksandra Janosz'), ('mikolaj','Mikołaj Mazur'), ('dagmara','Dagmara Janosz');

alter table public.slots add column trainer_id text references public.trainers(id);
alter table public.recurring_classes add column trainer_id text references public.trainers(id);

-- ===== KLIENCI =====
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'adult' check (kind in ('adult','pair','child')),
  first_name text not null,
  last_name text not null,
  partner_first_name text,   -- dla par
  partner_last_name text,
  guardian_name text,        -- dla dzieci: rodzic/opiekun
  guardian_phone text,
  phone text,
  phone_norm text generated always as (regexp_replace(coalesce(phone,''),'\D','','g')) stored,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
create index customers_email_idx on public.customers (lower(email));
create index customers_phone_idx on public.customers (phone_norm);
create index customers_name_idx on public.customers (lower(last_name), lower(first_name));

-- ===== PAKIETY (ślubne i karnety grupowe) =====
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  kind text not null check (kind in ('wedding_single','wedding_6','wedding_10','pass_4','pass_8','monthly')),
  label text not null,                      -- np. 'Pakiet 10 lekcji — pierwszy taniec'
  total_lessons int,                        -- null dla monthly
  wedding_date date,                        -- pakiety ślubne
  songs text[],                             -- propozycje piosenek (może być kilka)
  recurring_class_id uuid references public.recurring_classes(id),  -- karnety grupowe
  price_cents int not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','active','completed','expired','cancelled')),
  paid_at timestamptz,
  payment_method text check (payment_method in ('stripe','onsite','transfer')),
  stripe_checkout_session_id text,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now()
);
create index packages_customer_idx on public.packages (customer_id);
create index packages_class_idx on public.packages (recurring_class_id) where recurring_class_id is not null;

-- ===== ROZSZERZENIE BOOKINGS =====
alter table public.bookings
  add column customer_id uuid references public.customers(id),
  add column package_id uuid references public.packages(id),
  add column lesson_no int,                                   -- liczba porządkowa w pakiecie
  add column confirm_token uuid not null default gen_random_uuid(),
  add column confirmed_at timestamptz,
  add column reminder_sent_at timestamptz,
  add column rescheduled_from uuid references public.slots(id);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_package_idx on public.bookings (package_id) where package_id is not null;
create unique index bookings_confirm_token_idx on public.bookings (confirm_token);

-- ===== EWIDENCJA =====
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  recurring_class_id uuid not null references public.recurring_classes(id),
  session_date date not null,
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  note text,
  unique (recurring_class_id, session_date)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  present boolean not null default true,
  package_id uuid references public.packages(id),  -- karnet, z którego zużyto wejście
  created_at timestamptz not null default now(),
  unique (class_session_id, customer_id)
);

-- ===== LOG ZDARZEŃ =====
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,                 -- auth.uid() admina; null = system/klient
  actor_label text not null,     -- 'ola', 'system', 'client'
  action text not null,          -- 'booking.created','booking.moved','payment.recorded',...
  entity text not null,
  entity_id text,
  customer_id uuid references public.customers(id),
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_customer_idx on public.audit_log (customer_id, created_at desc);

-- ===== RLS: wszystko admin-only, zero dostępu publicznego =====
alter table public.trainers enable row level security;
alter table public.customers enable row level security;
alter table public.packages enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.audit_log enable row level security;

create policy "public read trainers" on public.trainers for select using (active = true);
create policy "admin all customers" on public.customers for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all packages" on public.packages for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all class_sessions" on public.class_sessions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all attendance" on public.attendance for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all audit" on public.audit_log for all using (public.is_admin()) with check (public.is_admin());

-- ===== POMOCNICZE FUNKCJE =====
-- Znajdź lub załóż klienta (używane wewnątrz RPC zapisu; działa jako definer)
create or replace function public.find_or_create_customer(
  p_first_name text, p_last_name text, p_phone text, p_email text,
  p_kind text default 'adult',
  p_partner_first_name text default null, p_partner_last_name text default null,
  p_guardian_name text default null, p_guardian_phone text default null
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare v_id uuid; v_phone_norm text;
begin
  v_phone_norm := regexp_replace(coalesce(p_phone,''),'\D','','g');
  select id into v_id from public.customers
    where lower(email) = lower(trim(p_email)) and phone_norm = v_phone_norm
    limit 1;
  if v_id is null then
    insert into public.customers (kind, first_name, last_name, phone, email,
      partner_first_name, partner_last_name, guardian_name, guardian_phone)
    values (p_kind, trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)),
      p_partner_first_name, p_partner_last_name, p_guardian_name, p_guardian_phone)
    returning id into v_id;
  else
    update public.customers set
      partner_first_name = coalesce(p_partner_first_name, partner_first_name),
      partner_last_name  = coalesce(p_partner_last_name, partner_last_name),
      guardian_name      = coalesce(p_guardian_name, guardian_name),
      guardian_phone     = coalesce(p_guardian_phone, guardian_phone)
    where id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.find_or_create_customer from public;
grant execute on function public.find_or_create_customer to service_role;  -- API pakietów woła ją bezpośrednio

-- Nadanie lekcji numeru porządkowego w pakiecie (atomowe)
create or replace function public.assign_booking_to_package(p_booking_id uuid, p_package_id uuid)
returns int
language plpgsql security definer set search_path = public as
$$
declare v_no int; v_total int; v_status text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(hashtext(p_package_id::text));
  select total_lessons, status into v_total, v_status from public.packages where id = p_package_id;
  if v_status not in ('active') then raise exception 'package_not_active'; end if;
  select count(*) + 1 into v_no from public.bookings
    where package_id = p_package_id and status <> 'cancelled';
  if v_total is not null and v_no > v_total then raise exception 'package_exhausted'; end if;
  update public.bookings set package_id = p_package_id, lesson_no = v_no,
    customer_id = (select customer_id from public.packages where id = p_package_id)
    where id = p_booking_id;
  if v_total is not null and v_no = v_total then
    update public.packages set status = 'completed' where id = p_package_id;
  end if;
  return v_no;
end $$;
revoke all on function public.assign_booking_to_package from public;
grant execute on function public.assign_booking_to_package to authenticated;

-- Potwierdzenie terminu przez klienta (tokenem z maila — bez logowania)
create or replace function public.confirm_booking(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as
$$
declare v_ok boolean;
begin
  update public.bookings b set confirmed_at = now()
    from public.slots s
    where b.confirm_token = p_token and b.confirmed_at is null
      and b.status <> 'cancelled' and b.slot_id = s.id and s.starts_at > now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;
revoke all on function public.confirm_booking from public;
grant execute on function public.confirm_booking to anon, authenticated;

-- ===== BACKFILL: klienci z dotychczasowych rezerwacji =====
-- last_name/email/phone mogą być null po RODO (0004); pomijamy wiersze bez maila i nazwiska.
insert into public.customers (first_name, last_name, phone, email)
select distinct on (lower(b.email), regexp_replace(coalesce(b.phone,''),'\D','','g'))
  b.first_name, b.last_name, b.phone, lower(b.email)
from public.bookings b
where b.email is not null
  and b.last_name is not null
order by lower(b.email), regexp_replace(coalesce(b.phone,''),'\D','','g'), b.created_at desc;

update public.bookings b set customer_id = c.id
from public.customers c
where lower(b.email) = lower(c.email)
  and regexp_replace(coalesce(b.phone,''),'\D','','g') = c.phone_norm
  and b.customer_id is null;

-- Nowa sygnatura (parametry opcjonalne na końcu). DROP, bo CREATE OR REPLACE
-- nie zastępuje funkcji o innej liście argumentów (powstałby overload).
drop function if exists public.create_booking(text, uuid, text, text, text, text, text, text, text, boolean);

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
  p_consent boolean,
  p_partner_first_name text default null,
  p_partner_last_name text default null,
  p_guardian_name text default null,
  p_guardian_phone text default null,
  p_customer_kind text default 'adult'
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare
  v_id uuid;
  v_customer_id uuid;
  v_occupancy record;
  v_event public.events%rowtype;
  v_taken int;
begin
  if not p_consent then raise exception 'consent_required'; end if;
  if p_first_name is null or length(trim(p_first_name)) < 2 then raise exception 'invalid_first_name'; end if;
  if p_last_name is null or length(trim(p_last_name)) < 2 then raise exception 'invalid_last_name'; end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if length(regexp_replace(p_phone,'\D','','g')) < 9 then raise exception 'invalid_phone'; end if;

  v_customer_id := public.find_or_create_customer(
    p_first_name, p_last_name, p_phone, p_email,
    coalesce(p_customer_kind, 'adult'),
    p_partner_first_name, p_partner_last_name,
    p_guardian_name, p_guardian_phone
  );

  if p_kind = 'slot' then
    update public.slots set status = 'booked'
      where id = p_target_id and status = 'open';
    if not found then raise exception 'slot_unavailable'; end if;
    insert into public.bookings (kind, slot_id, first_name, last_name, phone, email, message, dance_type, payment_option, payment_status, consent_rodo, customer_id)
    values ('slot', p_target_id, trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)), p_message, p_dance_type,
            coalesce(p_payment_option,'onsite'), case when coalesce(p_payment_option,'onsite')='onsite' then 'not_required' else 'pending' end, true, v_customer_id)
    returning id into v_id;

  elsif p_kind = 'class' then
    perform pg_advisory_xact_lock(hashtext(p_target_id::text));
    select * into v_occupancy from public.class_occupancy where recurring_class_id = p_target_id;
    if not exists (select 1 from public.recurring_classes where id = p_target_id and active and signup_open) then
      raise exception 'class_closed';
    end if;
    if v_occupancy.taken >= v_occupancy.capacity then raise exception 'class_full'; end if;
    insert into public.bookings (kind, recurring_class_id, first_name, last_name, phone, email, message, payment_option, payment_status, consent_rodo, customer_id)
    values ('class', p_target_id, trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)), p_message,
            coalesce(p_payment_option,'onsite'), case when coalesce(p_payment_option,'onsite')='onsite' then 'not_required' else 'pending' end, true, v_customer_id)
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
    insert into public.bookings (kind, event_id, first_name, last_name, phone, email, message, payment_option, payment_status, consent_rodo, customer_id)
    values ('event', p_target_id, trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)), p_message,
            coalesce(p_payment_option,'onsite'), case when coalesce(p_payment_option,'onsite')='onsite' then 'not_required' else 'pending' end, true, v_customer_id)
    returning id into v_id;

  else
    raise exception 'invalid_kind';
  end if;

  return v_id;
end
$$;

revoke all on function public.create_booking from public;
grant execute on function public.create_booking to anon, authenticated;
