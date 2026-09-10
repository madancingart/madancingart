-- Przeniesienie rezerwacji indywidualnej na inny wolny slot (atomowo).
-- Numer 0010: 0007 jest już zajęte (public_calendar trainer).

create or replace function public.admin_move_booking(
  p_booking_id uuid,
  p_new_slot_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_status text;
  v_old_slot uuid;
  v_customer uuid;
  v_old_starts timestamptz;
  v_old_ends timestamptz;
  v_new_starts timestamptz;
  v_new_ends timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select kind, status, slot_id, customer_id
    into v_kind, v_status, v_old_slot, v_customer
    from public.bookings
    where id = p_booking_id
    for update;

  if not found then
    raise exception 'booking_not_found';
  end if;
  if v_kind <> 'slot' or v_old_slot is null then
    raise exception 'not_slot_booking';
  end if;
  if v_status = 'cancelled' then
    raise exception 'booking_cancelled';
  end if;
  if v_old_slot = p_new_slot_id then
    raise exception 'same_slot';
  end if;

  if v_old_slot::text < p_new_slot_id::text then
    perform 1 from public.slots where id = v_old_slot for update;
    perform 1 from public.slots where id = p_new_slot_id for update;
  else
    perform 1 from public.slots where id = p_new_slot_id for update;
    perform 1 from public.slots where id = v_old_slot for update;
  end if;

  select starts_at, ends_at into v_old_starts, v_old_ends
    from public.slots where id = v_old_slot;
  select starts_at, ends_at into v_new_starts, v_new_ends
    from public.slots where id = p_new_slot_id;

  if v_new_starts is null then
    raise exception 'slot_unavailable';
  end if;

  update public.slots
    set status = 'booked'
    where id = p_new_slot_id and status = 'open';
  if not found then
    raise exception 'slot_unavailable';
  end if;

  update public.slots
    set status = 'open'
    where id = v_old_slot;

  update public.bookings
    set
      slot_id = p_new_slot_id,
      rescheduled_from = v_old_slot,
      confirmed_at = null,
      reminder_sent_at = null,
      confirm_token = gen_random_uuid()
    where id = p_booking_id;

  insert into public.audit_log (
    actor_id, actor_label, action, entity, entity_id, customer_id, details
  ) values (
    auth.uid(),
    'ola',
    'booking.moved',
    'booking',
    p_booking_id::text,
    v_customer,
    jsonb_build_object(
      'from_slot_id', v_old_slot,
      'to_slot_id', p_new_slot_id,
      'from_starts_at', v_old_starts,
      'from_ends_at', v_old_ends,
      'to_starts_at', v_new_starts,
      'to_ends_at', v_new_ends
    )
  );
end
$$;

revoke all on function public.admin_move_booking(uuid, uuid) from public;
grant execute on function public.admin_move_booking(uuid, uuid) to authenticated;
