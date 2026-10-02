-- =====================================================================
-- 0008_accounts_billing.sql — konta klientów, zapisy stałe, należności, kursy
-- =====================================================================

-- ---------- KONTA KLIENTÓW ----------
create table public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  interests text[] not null default '{}',      -- slugi class_types wybrane przy rejestracji
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- uczestnik (customer) należy do konta: dorosły sam, para, albo dziecko rodzica
alter table public.customers
  add column owner_user_id uuid references auth.users(id) on delete set null;
create index customers_owner_idx on public.customers (owner_user_id);

-- ---------- CENA GRUPY ----------
-- id pozycji z src/content/pricing.ts; grupa bez ceny NIE jest rozliczana przez bota
alter table public.recurring_classes add column price_item_id text;

-- ---------- ZAPISY STAŁE (członkostwo w grupie) ----------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  recurring_class_id uuid not null references public.recurring_classes(id),
  status text not null default 'pending'
    check (status in ('pending','active','paused','ended','lapsed')),
  billing_mode text not null default 'monthly' check (billing_mode in ('monthly','pass4')),
  started_on date not null default (now() at time zone 'Europe/Warsaw')::date,
  billing_start date not null default (now() at time zone 'Europe/Warsaw')::date,
  paid_until date,                 -- „opłacone do" — jedno źródło prawdy dla rozliczeń miesięcznych
  paused_from date,
  paused_until date,
  ended_on date,
  hold_expires_at timestamptz,     -- miejsce trzymane do opłacenia pierwszej należności
  source text not null default 'online' check (source in ('online','admin','import','legacy')),
  created_at timestamptz not null default now()
);
create unique index enrollments_one_open_uq on public.enrollments (customer_id, recurring_class_id)
  where status in ('pending','active','paused');
create index enrollments_class_idx on public.enrollments (recurring_class_id)
  where status in ('pending','active','paused');
create index enrollments_customer_idx on public.enrollments (customer_id);

-- ---------- NALEŻNOŚCI (rejestr: co, za jaki okres, ile, czy zapłacone) ----------
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  enrollment_id uuid references public.enrollments(id),
  series_booking_id uuid references public.bookings(id),
  kind text not null check (kind in ('first','monthly','prepaid','pass4','series','skip','manual')),
  label text not null,
  period_start date,
  period_end date,
  sessions_count int,
  amount_cents int not null check (amount_cents >= 0),
  due_date date not null,
  status text not null default 'open' check (status in ('open','paid','void')),
  paid_at timestamptz,
  payment_method text check (payment_method in ('stripe','onsite','transfer','legacy')),
  stripe_checkout_session_id text,
  pay_token uuid not null default gen_random_uuid(),
  reminder_stage int not null default 0,   -- 0 brak, 1 wystawiona, 2 przed terminem, 3 zaległość, 4 druga zaległość
  last_reminded_at timestamptz,
  note text,                               -- widoczne dla klienta
  void_reason text,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  constraint charges_period_valid check (period_start is null or period_end >= period_start)
);
create unique index charges_pay_token_uq on public.charges (pay_token);
create index charges_customer_idx on public.charges (customer_id, created_at desc);
create index charges_open_due_idx on public.charges (due_date) where status = 'open';
-- idempotencja generatora: jedna należność na okres na zapis
create unique index charges_enrollment_period_uq on public.charges (enrollment_id, period_start)
  where enrollment_id is not null and period_start is not null and status <> 'void';
create unique index charges_one_open_pass_uq on public.charges (enrollment_id)
  where kind = 'pass4' and status = 'open';
create unique index charges_one_open_series_uq on public.charges (series_booking_id)
  where series_booking_id is not null and status = 'open';

-- ---------- KURSY WIELOSPOTKANIOWE ----------
create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  location_id text references public.locations(id),
  trainer_id text references public.trainers(id),
  capacity int,
  price_cents int not null check (price_cents >= 0),
  allow_single boolean not null default false,
  single_price_cents int,
  signup_open boolean not null default true,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.events
  add column series_id uuid references public.event_series(id) on delete cascade,
  add column session_no int;
create index events_series_idx on public.events (series_id, starts_at) where series_id is not null;

alter table public.bookings add column series_id uuid references public.event_series(id);
create index bookings_series_idx on public.bookings (series_id) where series_id is not null;
alter table public.bookings drop constraint if exists bookings_kind_check;
alter table public.bookings add constraint bookings_kind_check
  check (kind in ('slot','class','event','series'));
alter table public.bookings drop constraint if exists bookings_target;
alter table public.bookings add constraint bookings_target check (
  (kind='slot'   and slot_id is not null and recurring_class_id is null and event_id is null and series_id is null) or
  (kind='class'  and recurring_class_id is not null and slot_id is null and event_id is null and series_id is null) or
  (kind='event'  and event_id is not null and slot_id is null and recurring_class_id is null and series_id is null) or
  (kind='series' and series_id is not null and slot_id is null and recurring_class_id is null and event_id is null)
);

-- obecności także na spotkaniach kursów
alter table public.attendance alter column class_session_id drop not null;
alter table public.attendance add column event_id uuid references public.events(id) on delete cascade;
alter table public.attendance add constraint attendance_one_target
  check (num_nonnulls(class_session_id, event_id) = 1);
create unique index attendance_event_customer_uq on public.attendance (event_id, customer_id)
  where event_id is not null;

-- ---------- WIDOKI ----------
-- obłożenie grup liczone z zapisów stałych (nie z bookings)
create or replace view public.class_occupancy
with (security_invoker = off) as
select rc.id as recurring_class_id,
       count(e.id) filter (where e.status in ('pending','active','paused')) as taken,
       rc.capacity
from public.recurring_classes rc
left join public.enrollments e on e.recurring_class_id = rc.id
group by rc.id, rc.capacity;

create or replace view public.series_occupancy
with (security_invoker = off) as
select s.id as series_id,
       count(b.id) filter (where b.status <> 'cancelled') as taken,
       s.capacity
from public.event_series s
left join public.bookings b on b.series_id = s.id
where s.published
group by s.id, s.capacity;
grant select on public.series_occupancy to anon, authenticated;

-- ---------- STARE ZAPISY NA GRUPY: od teraz tylko przez enrollments ----------
create or replace function public.block_class_bookings() returns trigger
language plpgsql as $$
begin
  if new.kind = 'class' then
    raise exception 'account_required';
  end if;
  return new;
end $$;
create trigger bookings_block_class_insert before insert on public.bookings
  for each row execute function public.block_class_bookings();

-- ---------- RLS ----------
alter table public.account_profiles enable row level security;
alter table public.enrollments enable row level security;
alter table public.charges enable row level security;
alter table public.event_series enable row level security;

create or replace function public.owns_customer(p_customer_id uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.customers
                  where id = p_customer_id and owner_user_id = auth.uid()) $$;

create policy "own profile read" on public.account_profiles for select using (user_id = auth.uid());
create policy "admin all profiles" on public.account_profiles for all
  using (public.is_admin()) with check (public.is_admin());

create policy "client read own enrollments" on public.enrollments for select
  using (public.owns_customer(customer_id));
create policy "admin all enrollments" on public.enrollments for all
  using (public.is_admin()) with check (public.is_admin());

create policy "client read own charges" on public.charges for select
  using (public.owns_customer(customer_id));
create policy "admin all charges" on public.charges for all
  using (public.is_admin()) with check (public.is_admin());

create policy "client read own bookings" on public.bookings for select
  using (customer_id is not null and public.owns_customer(customer_id));
create policy "client read own packages" on public.packages for select
  using (public.owns_customer(customer_id));
create policy "client read own attendance" on public.attendance for select
  using (public.owns_customer(customer_id));

create policy "public read series" on public.event_series for select using (published = true);
create policy "admin all series" on public.event_series for all
  using (public.is_admin()) with check (public.is_admin());

-- UWAGA: customers celowo BEZ polityki dla klienta — kolumna notes to notatki admina.
-- Klient czyta swoich uczestników wyłącznie przez my_participants().

-- ---------- FUNKCJE KLIENTA ----------
create or replace function public.my_participants()
returns table (id uuid, kind text, first_name text, last_name text,
               partner_first_name text, partner_last_name text, phone text, email text)
language sql stable security definer set search_path = public as
$$ select c.id, c.kind, c.first_name, c.last_name, c.partner_first_name, c.partner_last_name, c.phone, c.email
   from public.customers c where c.owner_user_id = auth.uid() order by c.created_at $$;
revoke all on function public.my_participants from public;
grant execute on function public.my_participants to authenticated;

create or replace function public.upsert_my_profile(
  p_first_name text, p_last_name text, p_phone text, p_interests text[] default '{}'
) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if length(trim(coalesce(p_first_name,''))) < 2 or length(trim(coalesce(p_last_name,''))) < 2 then
    raise exception 'invalid_name';
  end if;
  if length(regexp_replace(coalesce(p_phone,''),'\D','','g')) < 9 then raise exception 'invalid_phone'; end if;
  insert into public.account_profiles (user_id, first_name, last_name, phone, interests)
  values (auth.uid(), trim(p_first_name), trim(p_last_name), p_phone, coalesce(p_interests,'{}'))
  on conflict (user_id) do update set
    first_name = excluded.first_name, last_name = excluded.last_name,
    phone = excluded.phone, interests = excluded.interests;
end $$;
revoke all on function public.upsert_my_profile from public;
grant execute on function public.upsert_my_profile to authenticated;

create or replace function public.add_participant(
  p_kind text, p_first_name text, p_last_name text,
  p_partner_first_name text default null, p_partner_last_name text default null
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare v_profile public.account_profiles%rowtype; v_email text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('adult','pair','child') then raise exception 'invalid_kind'; end if;
  if length(trim(coalesce(p_first_name,''))) < 2 or length(trim(coalesce(p_last_name,''))) < 2 then
    raise exception 'invalid_name';
  end if;
  if p_kind = 'pair' and (length(trim(coalesce(p_partner_first_name,''))) < 2
                          or length(trim(coalesce(p_partner_last_name,''))) < 2) then
    raise exception 'partner_required';
  end if;
  select * into v_profile from public.account_profiles where user_id = auth.uid();
  if not found then raise exception 'profile_required'; end if;
  select email into v_email from auth.users where id = auth.uid();

  insert into public.customers (kind, first_name, last_name, partner_first_name, partner_last_name,
                                guardian_name, guardian_phone, phone, email, owner_user_id)
  values (p_kind, trim(p_first_name), trim(p_last_name),
          case when p_kind = 'pair' then trim(p_partner_first_name) end,
          case when p_kind = 'pair' then trim(p_partner_last_name) end,
          case when p_kind = 'child' then v_profile.first_name || ' ' || v_profile.last_name end,
          case when p_kind = 'child' then v_profile.phone end,
          v_profile.phone, lower(v_email), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.add_participant from public;
grant execute on function public.add_participant to authenticated;

create or replace function public.update_my_participant(
  p_id uuid, p_first_name text, p_last_name text,
  p_partner_first_name text default null, p_partner_last_name text default null
) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not public.owns_customer(p_id) then raise exception 'forbidden'; end if;
  if length(trim(coalesce(p_first_name,''))) < 2 or length(trim(coalesce(p_last_name,''))) < 2 then
    raise exception 'invalid_name';
  end if;
  update public.customers set
    first_name = trim(p_first_name),
    last_name  = trim(p_last_name),
    partner_first_name = case when kind = 'pair' then coalesce(nullif(trim(p_partner_first_name),''), partner_first_name) else partner_first_name end,
    partner_last_name  = case when kind = 'pair' then coalesce(nullif(trim(p_partner_last_name),''), partner_last_name) else partner_last_name end
  where id = p_id;
end $$;
revoke all on function public.update_my_participant from public;
grant execute on function public.update_my_participant to authenticated;

-- Podpięcie dotychczasowych klientów (sprzed kont) po ZWERYFIKOWANYM mailu
create or replace function public.claim_my_customers() returns int
language plpgsql security definer set search_path = public as
$$
declare v_email text; v_confirmed timestamptz; v_count int;
begin
  if auth.uid() is null then return 0; end if;
  select email, email_confirmed_at into v_email, v_confirmed from auth.users where id = auth.uid();
  if v_email is null or v_confirmed is null then return 0; end if;
  update public.customers set owner_user_id = auth.uid()
   where owner_user_id is null and lower(email) = lower(v_email);
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into public.audit_log (actor_id, actor_label, action, entity, entity_id, details)
    values (auth.uid(), 'client', 'account.claimed', 'user', auth.uid()::text,
            jsonb_build_object('customers', v_count));
  end if;
  return v_count;
end $$;
revoke all on function public.claim_my_customers from public;
grant execute on function public.claim_my_customers to authenticated;

-- Zapis na stałe zajęcia (miejsce trzymane 72 h do opłacenia)
create or replace function public.enroll_in_class(p_customer_id uuid, p_class_id uuid)
returns table (enrollment_id uuid, is_new boolean)
language plpgsql security definer set search_path = public as
$$
declare v_existing uuid; v_taken int; v_capacity int; v_new uuid;
begin
  if not (public.owns_customer(p_customer_id) or public.is_admin()) then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(hashtext(p_class_id::text));
  select e.id into v_existing from public.enrollments e
   where e.customer_id = p_customer_id and e.recurring_class_id = p_class_id
     and e.status in ('pending','active','paused');
  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;
  if not exists (select 1 from public.recurring_classes
                  where id = p_class_id and active and signup_open) then
    raise exception 'class_closed';
  end if;
  select o.taken, o.capacity into v_taken, v_capacity
    from public.class_occupancy o where o.recurring_class_id = p_class_id;
  if v_taken >= v_capacity then raise exception 'class_full'; end if;
  insert into public.enrollments (customer_id, recurring_class_id, status, hold_expires_at, source)
  values (p_customer_id, p_class_id, 'pending', now() + interval '72 hours',
          case when public.is_admin() then 'admin' else 'online' end)
  returning id into v_new;
  insert into public.audit_log (actor_id, actor_label, action, entity, entity_id, customer_id)
  values (auth.uid(), case when public.is_admin() then 'admin' else 'client' end,
          'enrollment.created', 'enrollment', v_new::text, p_customer_id);
  return query select v_new, true;
end $$;
revoke all on function public.enroll_in_class from public;
grant execute on function public.enroll_in_class to authenticated;

-- Zapis na cały kurs jednym kliknięciem
create or replace function public.enroll_in_series(p_customer_id uuid, p_series_id uuid)
returns table (booking_id uuid, is_new boolean)
language plpgsql security definer set search_path = public as
$$
declare v_existing uuid; v_taken int; v_capacity int; v_new uuid; c public.customers%rowtype;
begin
  if not (public.owns_customer(p_customer_id) or public.is_admin()) then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(hashtext(p_series_id::text));
  select b.id into v_existing from public.bookings b
   where b.series_id = p_series_id and b.customer_id = p_customer_id and b.status <> 'cancelled';
  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;
  if not exists (select 1 from public.event_series
                  where id = p_series_id and published and signup_open) then
    raise exception 'series_closed';
  end if;
  select o.taken, o.capacity into v_taken, v_capacity
    from public.series_occupancy o where o.series_id = p_series_id;
  if v_capacity is not null and v_taken >= v_capacity then raise exception 'series_full'; end if;
  select * into c from public.customers where id = p_customer_id;
  insert into public.bookings (kind, series_id, customer_id, first_name, last_name, phone, email,
                               status, payment_option, payment_status, consent_rodo)
  values ('series', p_series_id, p_customer_id, c.first_name, c.last_name,
          coalesce(c.phone, c.guardian_phone, ''), coalesce(c.email, ''),
          'pending', 'full', 'pending', true)
  returning id into v_new;
  insert into public.audit_log (actor_id, actor_label, action, entity, entity_id, customer_id)
  values (auth.uid(), case when public.is_admin() then 'admin' else 'client' end,
          'series.enrolled', 'booking', v_new::text, p_customer_id);
  return query select v_new, true;
end $$;
revoke all on function public.enroll_in_series from public;
grant execute on function public.enroll_in_series to authenticated;

-- ---------- FUNKCJE ROZLICZEŃ (tylko serwer: service_role) ----------
-- „Opłacone do" = koniec najdłuższego ciągłego łańcucha opłaconych okresów
create or replace function public.recompute_paid_until(p_enrollment_id uuid) returns date
language plpgsql security definer set search_path = public as
$$
declare v_until date; r record;
begin
  for r in select period_start, period_end from public.charges
            where enrollment_id = p_enrollment_id and status = 'paid'
              and period_start is not null and period_end is not null
            order by period_start, period_end loop
    if v_until is null or r.period_start <= v_until + 1 then
      v_until := greatest(coalesce(v_until, r.period_end), r.period_end);
    end if;
  end loop;
  update public.enrollments set paid_until = v_until where id = p_enrollment_id;
  return v_until;
end $$;
revoke all on function public.recompute_paid_until from public;
grant execute on function public.recompute_paid_until to service_role;

-- Zaksięgowanie wpłaty: jedyne miejsce, które zmienia stan pieniędzy
create or replace function public.apply_charge_payment(
  p_charge_id uuid, p_method text, p_stripe_session_id text default null
) returns text
language plpgsql security definer set search_path = public as
$$
declare ch public.charges%rowtype; v_rc uuid; v_today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if p_method not in ('stripe','onsite','transfer','legacy') then raise exception 'invalid_method'; end if;
  select * into ch from public.charges where id = p_charge_id for update;
  if not found then raise exception 'charge_not_found'; end if;
  if ch.status = 'paid' then return 'already_paid'; end if;      -- podwójny webhook = no-op

  update public.charges set status = 'paid', paid_at = now(), payment_method = p_method,
         stripe_checkout_session_id = coalesce(p_stripe_session_id, stripe_checkout_session_id)
   where id = p_charge_id;

  if ch.status = 'void' then
    -- pieniądze przyszły na anulowaną należność: nie gubimy ich, oznaczamy do wyjaśnienia
    insert into public.audit_log (actor_label, action, entity, entity_id, customer_id, details)
    values ('system', 'payment.on_void_charge', 'charge', p_charge_id::text, ch.customer_id,
            jsonb_build_object('amount_cents', ch.amount_cents, 'method', p_method));
    return 'paid_void_needs_review';
  end if;

  if ch.enrollment_id is not null then
    if ch.kind = 'pass4' then
      select recurring_class_id into v_rc from public.enrollments where id = ch.enrollment_id;
      insert into public.packages (customer_id, kind, label, total_lessons, recurring_class_id,
                                   price_cents, status, paid_at, payment_method, valid_from, valid_until)
      values (ch.customer_id, 'pass_4', ch.label, 4, v_rc, ch.amount_cents, 'active', now(),
              case when p_method in ('stripe','onsite','transfer') then p_method else 'onsite' end,
              v_today, (v_today + interval '3 months')::date);
    elsif ch.period_end is not null then
      perform public.recompute_paid_until(ch.enrollment_id);
    end if;
    update public.enrollments e set status = 'active', hold_expires_at = null
     where e.id = ch.enrollment_id and e.status in ('pending','lapsed')
       and not exists (select 1 from public.enrollments o
                        where o.customer_id = e.customer_id and o.recurring_class_id = e.recurring_class_id
                          and o.id <> e.id and o.status in ('pending','active','paused'));
  end if;

  if ch.series_booking_id is not null then
    update public.bookings set payment_status = 'paid', status = 'confirmed'
     where id = ch.series_booking_id;
  end if;

  insert into public.audit_log (actor_label, action, entity, entity_id, customer_id, details)
  values ('system', 'payment.recorded', 'charge', p_charge_id::text, ch.customer_id,
          jsonb_build_object('amount_cents', ch.amount_cents, 'method', p_method, 'label', ch.label));
  return 'ok';
end $$;
revoke all on function public.apply_charge_payment from public;
grant execute on function public.apply_charge_payment to service_role;

-- ---------- POPRAWKA ETAPU 2: rodzeństwo nie może zlewać się w jednego klienta ----------
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
   where lower(email) = lower(trim(p_email))
     and phone_norm = v_phone_norm
     and kind = coalesce(p_kind, 'adult')
     and (coalesce(p_kind, 'adult') <> 'child' or lower(first_name) = lower(trim(p_first_name)))
   order by created_at
   limit 1;
  if v_id is null then
    insert into public.customers (kind, first_name, last_name, phone, email,
      partner_first_name, partner_last_name, guardian_name, guardian_phone)
    values (coalesce(p_kind,'adult'), trim(p_first_name), trim(p_last_name), p_phone, lower(trim(p_email)),
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
grant execute on function public.find_or_create_customer to service_role;

-- ---------- BACKFILL: dotychczasowi członkowie grup → enrollments ----------
-- Rozliczanie legacy startuje od 1. dnia NASTĘPNEGO miesiąca (zero naliczeń wstecz).
insert into public.enrollments (customer_id, recurring_class_id, status, started_on, billing_start, source)
select distinct on (b.customer_id, b.recurring_class_id)
       b.customer_id, b.recurring_class_id, 'active',
       (b.created_at at time zone 'Europe/Warsaw')::date,
       (date_trunc('month', now() at time zone 'Europe/Warsaw') + interval '1 month')::date,
       'legacy'
from public.bookings b
where b.kind = 'class' and b.status <> 'cancelled' and b.customer_id is not null
order by b.customer_id, b.recurring_class_id, b.created_at;

-- osoby z opłaconym karnetem/miesiącem na grupę, ale bez rekordu zapisu
insert into public.enrollments (customer_id, recurring_class_id, status, started_on, billing_start, source)
select distinct on (p.customer_id, p.recurring_class_id)
       p.customer_id, p.recurring_class_id, 'active',
       coalesce(p.valid_from, (p.created_at at time zone 'Europe/Warsaw')::date),
       (date_trunc('month', now() at time zone 'Europe/Warsaw') + interval '1 month')::date,
       'legacy'
from public.packages p
where p.recurring_class_id is not null and p.status = 'active'
  and not exists (select 1 from public.enrollments e
                   where e.customer_id = p.customer_id and e.recurring_class_id = p.recurring_class_id)
order by p.customer_id, p.recurring_class_id, p.created_at;

-- wpłaty miesięczne z Etapu 2 (packages.kind='monthly') → rejestr należności jako opłacone
insert into public.charges (customer_id, enrollment_id, kind, label, period_start, period_end,
                            amount_cents, due_date, status, paid_at, payment_method, note, created_by)
select p.customer_id, e.id, 'manual', p.label, p.valid_from, p.valid_until, p.price_cents,
       coalesce(p.valid_from, (p.paid_at at time zone 'Europe/Warsaw')::date),
       'paid', p.paid_at, coalesce(p.payment_method, 'onsite'),
       'Wpłata zarejestrowana przed uruchomieniem rozliczeń online', 'migration'
from public.packages p
join public.enrollments e
  on e.customer_id = p.customer_id and e.recurring_class_id = p.recurring_class_id
 and e.status in ('pending','active','paused')
where p.kind = 'monthly' and p.paid_at is not null
on conflict do nothing;

select public.recompute_paid_until(id) from public.enrollments;
