alter table public.events
  add column price_cents int check (price_cents is null or price_cents >= 0),
  add column cancelled_at timestamptz,
  add column cancel_reason text;
