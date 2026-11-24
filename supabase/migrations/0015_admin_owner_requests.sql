-- Owner requests: free client signup on groups + editable price catalog.

alter table public.recurring_classes
  add column if not exists free_signup boolean not null default false;

comment on column public.recurring_classes.free_signup is
  'Gdy true, klient może zapisać się bez pierwszej należności (jak admin skipFirstPayment).';

create table if not exists public.price_items (
  id text primary key,
  location_id text not null references public.locations(id),
  section text not null,
  label text not null,
  detail text,
  amount_cents int not null check (amount_cents >= 0),
  unit text not null check (unit in ('os/mies','para/mies','os','para','h','pakiet')),
  note text,
  billing text not null check (billing in ('monthly','pass4','one-off')),
  sort_order int not null default 0,
  active boolean not null default true,
  prepaid_months int check (prepaid_months is null or prepaid_months = 3),
  prepaid_amount_cents int check (prepaid_amount_cents is null or prepaid_amount_cents >= 0),
  prepaid_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_items_prepaid_consistent check (
    (prepaid_months is null and prepaid_amount_cents is null and prepaid_label is null)
    or (prepaid_months is not null and prepaid_amount_cents is not null and prepaid_label is not null)
  )
);

create index if not exists price_items_location_sort
  on public.price_items (location_id, sort_order, id);

alter table public.price_items enable row level security;

drop policy if exists "public read price_items" on public.price_items;
create policy "public read price_items"
  on public.price_items for select
  using (active = true);

drop policy if exists "admin all price_items" on public.price_items;
create policy "admin all price_items"
  on public.price_items for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.price_items (
  id, location_id, section, label, detail, amount_cents, unit, note, billing,
  sort_order, prepaid_months, prepaid_amount_cents, prepaid_label
) values
  ('mikolow-dzieci-mies', 'mikolow', 'Zajęcia dla dzieci', 'Zajęcia miesięczne', '45 min', 13000, 'os/mies', null, 'monthly', 0, null, null, null),
  ('mikolow-latino-mies', 'mikolow', 'Latino solo', 'Zajęcia miesięczne', '50 min', 12000, 'os/mies', null, 'monthly', 100, null, null, null),
  ('mikolow-uzytkowy-50', 'mikolow', 'Taniec użytkowy', 'Zajęcia miesięczne', '50 min', 24000, 'para/mies', null, 'monthly', 200, null, null, null),
  ('mikolow-uzytkowy-75', 'mikolow', 'Taniec użytkowy', 'Zajęcia miesięczne', '1 h 15 min', 36000, 'para/mies', null, 'monthly', 201, null, null, null),
  ('mikolow-ind-1h', 'mikolow', 'Lekcje indywidualne', '1 h', null, 15000, 'h', null, 'one-off', 300, null, null, null),
  ('mikolow-ind-6h', 'mikolow', 'Lekcje indywidualne', 'Pakiet 6 h', null, 80000, 'pakiet', null, 'one-off', 301, null, null, null),
  ('mikolow-ind-10h', 'mikolow', 'Lekcje indywidualne', 'Pakiet 10 h', null, 120000, 'pakiet', null, 'one-off', 302, null, null, null),
  ('lubliniec-dzieci-mies', 'lubliniec', 'Zajęcia dla dzieci', 'Zajęcia miesięczne', null, 13000, 'os/mies', null, 'monthly', 0, null, null, null),
  ('lubliniec-latino-4x-60', 'lubliniec', 'Latino solo', '4 wejścia', '1 h', 12000, 'os', null, 'pass4', 100, null, null, null),
  ('lubliniec-latino-4x-75', 'lubliniec', 'Latino solo', '4 wejścia', '1 h 15 min', 18000, 'os', null, 'pass4', 101, null, null, null),
  ('lubliniec-uzytkowy-4x-60', 'lubliniec', 'Taniec użytkowy', '4 wejścia', '1 h', 24000, 'para', null, 'pass4', 200, null, null, null),
  ('lubliniec-uzytkowy-4x-75', 'lubliniec', 'Taniec użytkowy', '4 wejścia', '1 h 15 min', 36000, 'para', null, 'pass4', 201, null, null, null),
  ('lubliniec-ind-1h', 'lubliniec', 'Lekcje indywidualne', '1 h', null, 15000, 'h', null, 'one-off', 300, null, null, null),
  ('lubliniec-ind-6h', 'lubliniec', 'Lekcje indywidualne', 'Pakiet 6 h', null, 80000, 'pakiet', null, 'one-off', 301, null, null, null),
  ('lubliniec-ind-10h', 'lubliniec', 'Lekcje indywidualne', 'Pakiet 10 h', null, 120000, 'pakiet', null, 'one-off', 302, null, null, null),
  ('lubliniec-promo-75-4', 'lubliniec', 'Promocja — taniec użytkowy', '4 wejścia', '1 h 15 min', 36000, 'para', null, 'pass4', 400, null, null, null),
  ('lubliniec-promo-75-8', 'lubliniec', 'Promocja — taniec użytkowy', '8 wejść', '1 h 15 min', 72000, 'para', null, 'one-off', 401, null, null, null),
  ('lubliniec-promo-75-3m-1x', 'lubliniec', 'Promocja — taniec użytkowy', '3 miesiące, 1×/tydz.', '1 h 15 min', 95000, 'para', null, 'monthly', 402, 3, 95000, '3 miesiące 1×/tydz. — promocja'),
  ('lubliniec-promo-75-3m-2x', 'lubliniec', 'Promocja — taniec użytkowy', '3 miesiące, 2×/tydz.', '1 h 15 min', 190000, 'para', null, 'one-off', 403, null, null, null),
  ('lubliniec-promo-60-4', 'lubliniec', 'Promocja — taniec użytkowy', '4 wejścia', '1 h', 24000, 'para', null, 'pass4', 404, null, null, null),
  ('lubliniec-promo-60-3m', 'lubliniec', 'Promocja — taniec użytkowy', '3 miesiące', '1 h', 65000, 'para', null, 'monthly', 405, 3, 65000, '3 miesiące — promocja')
on conflict (id) do update set
  location_id = excluded.location_id,
  section = excluded.section,
  label = excluded.label,
  detail = excluded.detail,
  amount_cents = excluded.amount_cents,
  unit = excluded.unit,
  note = excluded.note,
  billing = excluded.billing,
  sort_order = excluded.sort_order,
  prepaid_months = excluded.prepaid_months,
  prepaid_amount_cents = excluded.prepaid_amount_cents,
  prepaid_label = excluded.prepaid_label,
  updated_at = now();
