-- Supabase nadaje EXECUTE nowym funkcjom w public rolom anon i authenticated
-- (domyślne uprawnienia projektu). REVOKE FROM public w 0011 tego nie zdejmuje.
-- Uprawnienia docelowe zostają takie, jak w 0011: funkcje klienta dla authenticated,
-- rozliczenia i find_or_create_customer tylko dla service_role.

revoke execute on function public.apply_charge_payment(uuid, text, text) from anon, authenticated;
revoke execute on function public.recompute_paid_until(uuid) from anon, authenticated;
revoke execute on function public.find_or_create_customer(text, text, text, text, text, text, text, text, text) from anon, authenticated;

revoke execute on function public.my_participants() from anon;
revoke execute on function public.upsert_my_profile(text, text, text, text[]) from anon;
revoke execute on function public.add_participant(text, text, text, text, text) from anon;
revoke execute on function public.update_my_participant(uuid, text, text, text, text) from anon;
revoke execute on function public.claim_my_customers() from anon;
revoke execute on function public.enroll_in_class(uuid, uuid) from anon;
revoke execute on function public.enroll_in_series(uuid, uuid) from anon;
