-- Public calendar needs cancelled class dates without exposing the reason note.
create or replace view public.public_cancelled_sessions
with (security_invoker = off) as
select
  recurring_class_id,
  session_date
from public.class_sessions
where status = 'cancelled';

grant select on public.public_cancelled_sessions to anon, authenticated;
