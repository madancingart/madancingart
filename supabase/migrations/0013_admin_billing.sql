-- Rozliczenia w panelu: anulowanie należności, data wpłaty, import przedpłat.
-- Status i „opłacone do" zmieniają wyłącznie te funkcje oraz apply_charge_payment.

drop function if exists public.apply_charge_payment(uuid, text, text);

create or replace function public.apply_charge_payment(
  p_charge_id uuid,
  p_method text,
  p_stripe_session_id text default null,
  p_paid_at timestamptz default null
) returns text
language plpgsql security definer set search_path = public as
$$
declare ch public.charges%rowtype; v_rc uuid; v_today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if p_method not in ('stripe','onsite','transfer','legacy') then raise exception 'invalid_method'; end if;
  select * into ch from public.charges where id = p_charge_id for update;
  if not found then raise exception 'charge_not_found'; end if;
  if ch.status = 'paid' then return 'already_paid'; end if;

  update public.charges set status = 'paid',
         paid_at = coalesce(p_paid_at, now()),
         payment_method = p_method,
         stripe_checkout_session_id = coalesce(p_stripe_session_id, stripe_checkout_session_id)
   where id = p_charge_id;

  if ch.status = 'void' then
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
      values (ch.customer_id, 'pass_4', ch.label, 4, v_rc, ch.amount_cents, 'active', coalesce(p_paid_at, now()),
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

revoke all on function public.apply_charge_payment(uuid, text, text, timestamptz) from public;
grant execute on function public.apply_charge_payment(uuid, text, text, timestamptz) to service_role;

create or replace function public.void_charge(p_charge_id uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as
$$
declare ch public.charges%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'reason_required'; end if;
  select * into ch from public.charges where id = p_charge_id for update;
  if not found then raise exception 'charge_not_found'; end if;
  if ch.status = 'paid' then raise exception 'charge_paid'; end if;
  if ch.status = 'open' then
    update public.charges
       set status = 'void', void_reason = trim(p_reason)
     where id = p_charge_id;
    insert into public.audit_log (actor_label, action, entity, entity_id, customer_id, details)
    values ('admin', 'charge.voided', 'charge', p_charge_id::text, ch.customer_id,
            jsonb_build_object('reason', trim(p_reason), 'amount_cents', ch.amount_cents));
  end if;
  return ch.enrollment_id;
end $$;

revoke all on function public.void_charge(uuid, text) from public;
grant execute on function public.void_charge(uuid, text) to service_role;

-- Jeden import, jedna transakcja. Należność powstaje jako otwarta i zamyka ją apply_charge_payment.
create or replace function public.import_paid_enrollments(p_rows jsonb)
returns int
language plpgsql security definer set search_path = public as
$$
declare
  r jsonb;
  v_customer uuid;
  v_enrollment uuid;
  v_charge uuid;
  v_paid date;
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_started date;
  v_amount int;
  v_method text;
  v_count int := 0;
  v_label text;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'invalid_rows'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    v_paid := (r->>'paid_until')::date;
    v_amount := (r->>'amount_cents')::int;
    v_method := coalesce(nullif(r->>'method', ''), 'legacy');
    if v_paid is null or v_amount is null or v_amount < 0 then
      raise exception 'invalid_row';
    end if;
    if v_method not in ('onsite','transfer','legacy') then
      raise exception 'invalid_method';
    end if;
    v_customer := public.find_or_create_customer(
      r->>'first_name', r->>'last_name', coalesce(r->>'phone', ''), coalesce(r->>'email', ''),
      coalesce(r->>'kind', 'adult'),
      nullif(r->>'partner_first_name', ''), nullif(r->>'partner_last_name', ''),
      nullif(r->>'guardian_name', ''), nullif(r->>'phone', '')
    );
    if exists (
      select 1 from public.enrollments
       where customer_id = v_customer and recurring_class_id = (r->>'class_id')::uuid
         and status in ('pending','active','paused')
    ) then
      raise exception 'already_enrolled:%', coalesce(r->>'email', v_customer::text);
    end if;
    v_started := least(v_today, v_paid);
    insert into public.enrollments (
      customer_id, recurring_class_id, status, billing_mode, started_on, billing_start, source
    ) values (
      v_customer, (r->>'class_id')::uuid, 'active',
      coalesce(nullif(r->>'billing_mode', ''), 'monthly'),
      v_started, v_paid + 1, 'import'
    ) returning id into v_enrollment;
    v_label := coalesce(nullif(trim(r->>'note'), ''), 'Przedpłata sprzed systemu');
    insert into public.charges (
      customer_id, enrollment_id, kind, label, period_start, period_end,
      amount_cents, due_date, status, note, created_by
    ) values (
      v_customer, v_enrollment, 'manual', v_label, v_started, v_paid,
      v_amount, v_today, 'open', v_label, 'import'
    ) returning id into v_charge;
    perform public.apply_charge_payment(v_charge, v_method, null, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke all on function public.import_paid_enrollments(jsonb) from public;
grant execute on function public.import_paid_enrollments(jsonb) to service_role;
