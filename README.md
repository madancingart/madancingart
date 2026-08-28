# M&A Dancing Art

Strona szkoły tańca M&A Dancing Art (Mikołów i Lubliniec). Next.js (App Router), TypeScript, Tailwind CSS v4.

## Wymagania

- Node.js 20+ (zalecane LTS)
- npm

## Uruchomienie

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

## Zmienne środowiskowe

Skopiuj `.env.local.example` do `.env.local` i uzupełnij wartości.

| Zmienna | Skąd wziąć |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Projekt w [Supabase](https://supabase.com) → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Tamże → Publishable key (klucz publiczny, wolno w przeglądarce). Działa też starsza nazwa `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Tamże → Secret keys → `service_role` (tylko serwer, nigdy `NEXT_PUBLIC_*`) |
| `RESEND_API_KEY` | [Resend](https://resend.com) → API Keys |
| `STRIPE_SECRET_KEY` | [Stripe](https://dashboard.stripe.com) → Developers → API keys (tylko serwer) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks (endpoint signing secret) |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `false` do czasu włączenia płatności |
| `NEXT_PUBLIC_SITE_URL` | Publiczny adres strony, lokalnie `http://localhost:3000` |

### Vercel

W **Project → Settings → Environment Variables** ustaw co najmniej:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (lub `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (np. `https://twoja-domena.pl`)
- `RESEND_API_KEY` (maile z zapisów)

Bez Supabase middleware nie wywali strony, ale **grafik, zapisy i panel admina nie zadziałają** — brak kluczy = błąd w Server Components / API.

Po dodaniu zmiennych: **Deployments → Redeploy** (env ładują się przy buildzie).

## Supabase (migracje)

Schemat i seed są w `supabase/migrations/`. Publiczny grafik czyta widok `public_calendar` (inicjał + typ tańca). Tabela `bookings` nie ma polityki dla `anon` — dane osobowe nie wychodzą kluczem publishable.

```bash
npx supabase login
npx supabase link --project-ref zvlehrqgnrhfdepqprnl
npx supabase db push
```

Hasło bazy: Dashboard → Project Settings → Database.

### Admini

Panel loguje się loginem **`admin`** (mapowane na `admin@madancingart.pl` w Supabase Auth) albo pełnym e-mailem z tabeli `admins`.

1. Authentication → Users → Add user (np. Twoje konto i konto Oli).
2. SQL editor:

```sql
insert into public.admins (user_id) values ('<uuid-usera-z-auth>');
```

### Test RLS (klucz publishable)

```bash
export URL=https://zvlehrqgnrhfdepqprnl.supabase.co
export KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

# bookings — brak dostępu
curl -sS "$URL/rest/v1/bookings?select=*" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY"

# kalendarz publiczny — bez nazwisk / telefonów / maili
curl -sS "$URL/rest/v1/public_calendar?select=*" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY"

# zapis bez zgody RODO
curl -sS "$URL/rest/v1/rpc/create_booking" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_kind":"slot","p_target_id":"00000000-0000-0000-0000-000000000000","p_first_name":"Anna","p_last_name":"Nowak","p_phone":"539143200","p_email":"test@example.com","p_message":null,"p_dance_type":null,"p_payment_option":"onsite","p_consent":false}'
```

## Maile (Resend)

Wysyłka idzie z Route Handlera (`src/lib/email.ts`) po udanym `create_booking`. Nadawca tymczasowo `onboarding@resend.dev` — **TODO:** po weryfikacji domeny w Resend zmienić na adres z domeny szkoły (np. `zapisy@…`).

Na darmowym planie Resend często przyjmuje tylko testy na e-mail właściciela konta, dopóki domena nie jest zweryfikowana.

## Testy ręczne zapisów

`NEXT_PUBLIC_PAYMENTS_ENABLED` zostaw na `false`. Przygotuj otwarty slot (SQL w edytorze Supabase), np. w oknie najbliższych 21 dni:

```sql
insert into public.slots (location_id, starts_at, ends_at, status)
values (
  'mikolow',
  (timestamp '2026-09-11 10:00:00' at time zone 'Europe/Warsaw'),
  (timestamp '2026-09-11 11:00:00' at time zone 'Europe/Warsaw'),
  'open'
)
returning id, starts_at, ends_at, status;
```

### Happy path

1. Otwórz `/grafik?lokalizacja=mikolow`, znajdź kafelek ze złotą obwódką („Wolny termin”).
2. Zarezerwuj: imię, nazwisko, telefon (`+48 539 143 200` albo 9 cyfr), e-mail, typ zajęć, zgoda RODO.
3. Bez zgody przycisk nie przechodzi — komunikat przy checkboxie.
4. Po wysłaniu: „Zapis przyjęty!” i mail na podany adres oraz na `madancingart@gmail.com`.
5. Odśwież grafik: slot ma inicjał + typ tańca, nie pełne nazwisko.

### Podwójny zapis na slot

1. Otwórz ten sam wolny termin w dwóch kartach przeglądarki.
2. Wyślij zapis w obu (różne maile).
3. Jeden dostaje sukces, drugi komunikat: „Ktoś właśnie zarezerwował ten termin…”.

### Grupa pełna

1. W SQL ustaw `capacity` wybranej grupy na `1` (albo zapełnij miejsca zapisami).
2. Z `/grafik` zapisz się drugi raz na tę samą grupę.
3. Komunikat: „Grupa jest pełna…”.

### Honeypot

Pole `website` jest ukryte. Żądanie POST na `/api/bookings` z niepustym `website` musi dostać błąd i **nie** tworzyć wiersza w `bookings`.
```
