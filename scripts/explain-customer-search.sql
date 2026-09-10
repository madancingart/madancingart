-- Plany zapytań listy klientów (indeksy z 0006).
-- Uruchom po seedzie: npx supabase db query --linked -f scripts/explain-customer-search.sql

explain (analyze, buffers, format text)
select id
from public.customers
where lower(last_name) like 'testowska0500%'
order by lower(last_name), lower(first_name)
limit 30;

explain (analyze, buffers, format text)
select id
from public.customers
where phone_norm like '%512345%'
limit 30;

explain (analyze, buffers, format text)
select id
from public.customers
where last_name ilike '%testowska%'
   or first_name ilike '%testowska%'
   or email ilike '%testowska%'
   or partner_last_name ilike '%testowska%'
   or guardian_name ilike '%testowska%'
   or phone_norm like '%512345%'
order by last_name, first_name
limit 30;

explain (analyze, buffers, format text)
select id
from public.customers
order by created_at desc
limit 30;
