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
| `STRIPE_SECRET_KEY` | [Stripe](https://dashboard.stripe.com) → Developers → API keys (tylko serwer). Lokalnie: `stripe sandbox create` albo klucz testowy `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks, endpoint `POST /api/stripe/webhook`. Lokalnie: `stripe listen --forward-to localhost:3000/api/stripe/webhook` |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `true` żeby w formularzu zapisu pokazać płatność online |
| `NEXT_PUBLIC_SITE_URL` | Publiczny adres strony, lokalnie `http://localhost:3000` |
| `CRON_SECRET` | Losowy sekret; Vercel Cron wysyła `Authorization: Bearer CRON_SECRET` na `GET /api/cron/reminders` |
| `AUTO_RELEASE_UNCONFIRMED` | `true` zwalnia niepotwierdzone sloty 24 h przed startem. **Zostaw `false`**, dopóki Ola nie zdecyduje inaczej |

### Vercel

W **Project → Settings → Environment Variables** ustaw co najmniej:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (lub `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (np. `https://twoja-domena.pl`)
- `RESEND_API_KEY` (maile z zapisów)
- `CRON_SECRET` (przypomnienia o potwierdzeniu terminu)
- `AUTO_RELEASE_UNCONFIRMED=false` (zwalnianie niepotwierdzonych slotów — wyłączone)
- `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET` (płatności)
- `NEXT_PUBLIC_PAYMENTS_ENABLED=true` dopiero gdy Stripe jest skonfigurowany

`NEXT_PUBLIC_*` muszą być w buildzie — po dodaniu zmiennych: **Redeploy**. Sam Site URL / Redirect URLs w Supabase (Authentication → URL Configuration) ustaw na adres Vercela, np. `https://twoja-domena.vercel.app` oraz `https://twoja-domena.vercel.app/**`.

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

# CRM — klucz anon: customers / packages / attendance / audit_log → 0 wierszy (albo błąd braku SELECT)
for t in customers packages attendance audit_log; do
  echo "== $t =="
  curl -sS "$URL/rest/v1/$t?select=*" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY"
  echo
done
```

### CRM: jeden klient, dwa zapisy (ten sam mail + telefon)

W SQL editorze (service role / dashboard) przygotuj dwa otwarte sloty, potem dwukrotnie `create_booking` z tymi samymi `p_email` i `p_phone` (różne `p_target_id`). Oczekiwane:

```sql
-- jeden wiersz w customers dla pary email+telefon
select id, email, phone, first_name, last_name
from public.customers
where lower(email) = 'anna.crm@example.com';

-- dwa bookingi wskazujące na tego samego customer_id
select id, slot_id, customer_id, email, phone
from public.bookings
where lower(email) = 'anna.crm@example.com'
order by created_at;
```

Przykład RPC (klucz publishable; podstaw prawdziwe `p_target_id` otwartych slotów):

```bash
BODY='{"p_kind":"slot","p_target_id":"<SLOT_UUID>","p_first_name":"Anna","p_last_name":"Nowak","p_phone":"539143200","p_email":"anna.crm@example.com","p_message":null,"p_dance_type":"salsa","p_payment_option":"onsite","p_consent":true}'
curl -sS "$URL/rest/v1/rpc/create_booking" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$BODY"
# drugi raz: zmień p_target_id na drugi wolny slot, reszta bez zmian
```

### CRM: confirm_booking (token z maila)

Klient potwierdza na `/potwierdz/{token}` (noindex). RPC `confirm_booking` ustawia `confirmed_at`. Token zużyty, anulowany albo po starcie terminu → komunikat z telefonem szkoły.

Cron codziennie o 08:00 UTC (`vercel.json` → `GET /api/cron/reminders`, nagłówek `Authorization: Bearer CRON_SECRET`): maile „Potwierdź swój termin” do rezerwacji slotów za 24–48 h bez `confirmed_at` i bez `reminder_sent_at`. Ponowne uruchomienie tego samego dnia nie dubluje (znacznik `reminder_sent_at`). `AUTO_RELEASE_UNCONFIRMED` zostaw na `false`.

```bash
# losowy token → false
curl -sS "$URL/rest/v1/rpc/confirm_booking" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_token":"00000000-0000-0000-0000-000000000000"}'
```

W SQL (dashboard) weź `confirm_token` z przyszłego, nieanulowanego zapisu na slot (`starts_at > now()`, `confirmed_at is null`). RPC z tym tokenem musi zwrócić `true`, a `bookings.confirmed_at` zostaje ustawione. Ponowne wywołanie tego samego tokenu → `false`.

### CRM: karnety grupowe (wejścia)

Status opłacenia członka grupy (`src/lib/membership-status.ts`) liczy zużycie karnetu `pass_4` / `pass_8` z tabeli `attendance` (obecność z `package_id`). Dziennik: `/admin/ewidencja`. Raport: `/admin/ewidencja/raport`.

### Konta, należności, kursy (Etap 3)

`0011_accounts_billing.sql` to schemat kont, zapisów stałych, należności i kursów. `0012_revoke_default_function_grants.sql` zdejmuje `EXECUTE`, które Supabase nadaje nowym funkcjom w `public` rolom `anon` i `authenticated`. Bez tego `REVOKE FROM public` zostawia te role z prawem wywołania.

Diagnoza rodzeństwa przed migracją (dziecko z więcej niż jednym imieniem w zapisach) zwróciła 0 wierszy, więc migracji rozdzielającej rodzeństwo nie ma.

Testy na projekcie `zvlehrqgnrhfdepqprnl` (2026-10-02). Konta testowe usunięte po sprawdzeniu.

- **anon:** `select` z `account_profiles`, `enrollments`, `charges`, `customers` → 0 wierszy. `rpc apply_charge_payment` i `my_participants` → `permission denied for function`.
- **zalogowany klient:** `select` z `customers` → 0 wierszy (uczestników czyta przez `my_participants()`, tylko własnych). Widzi tylko własne `enrollments`, `charges` i `bookings`.
- **klient A, `enroll_in_class` dla uczestnika klienta B** → `forbidden`.
- **`create_booking` z `kind = class`** → `account_required`. Wiersz zapisu i klienta z tej próby nie zostaje w bazie.
- **`apply_charge_payment` dwa razy na tej samej należności** → za drugim razem `already_paid`. `paid_until` po pierwszej wpłacie `2026-11-30`, po drugiej bez zmian.

## Stripe (płatności za zapis)

Kwoty liczy wyłącznie serwer z `src/content/pricing.ts` (pełna kwota z cennika). Checkout jest hostowany przez Stripe; fulfillment idzie przez webhook `checkout.session.completed` (status `paid` + mail). Po 30 minutach bez płatności `checkout.session.expired` zwalnia termin.

1. Ustaw `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET`.
2. W Dashboard włącz metody płatności (BLIK, karta itd.) — w kodzie nie ma `payment_method_types`.
3. Endpoint produkcyjny: `https://twoja-domena.pl/api/stripe/webhook` (zdarzenia: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`).
4. Ustaw `NEXT_PUBLIC_PAYMENTS_ENABLED=true` i zrób Redeploy (zmienna `NEXT_PUBLIC_*` wchodzi w build).

Lokalnie:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Karta testowa: `4242 4242 4242 4242`, dowolna przyszła data i CVC.

## Maile (Resend)

Wysyłka idzie z Route Handlera (`src/lib/email.ts`) po udanym `create_booking`. Nadawca tymczasowo `onboarding@resend.dev` — **TODO:** po weryfikacji domeny w Resend zmienić na adres z domeny szkoły (np. `zapisy@…`).

Na darmowym planie Resend często przyjmuje tylko testy na e-mail właściciela konta, dopóki domena nie jest zweryfikowana.

## Testy ręczne zapisów

Przygotuj otwarty slot (SQL w edytorze Supabase), np. w oknie najbliższych 21 dni:

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
