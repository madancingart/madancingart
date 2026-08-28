-- Anulowanie zapisu przez administratora: booking → cancelled,
-- a przy slocie indywidualnym status wraca na open (jedna transakcja).

create or replace function public.admin_cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_slot uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select kind, slot_id, status
    into v_kind, v_slot, v_status
    from public.bookings
    where id = p_booking_id
    for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  if v_status = 'cancelled' then
    return;
  end if;

  update public.bookings
    set status = 'cancelled'
    where id = p_booking_id;

  if v_kind = 'slot' and v_slot is not null then
    update public.slots
      set status = 'open'
      where id = v_slot;
  end if;
end
$$;

revoke all on function public.admin_cancel_booking(uuid) from public;
grant execute on function public.admin_cancel_booking(uuid) to authenticated;
