import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalArticle,
  LegalIdentity,
  LegalSection,
} from "@/components/legal/LegalArticle";
import { site } from "@/content/site";

const UPDATED = "2 października 2026";

export const metadata: Metadata = {
  title: "Polityka prywatności — M&A Dancing Art",
  description:
    "Kto administruje danymi w M&A Dancing Art, po co je zbieramy i jakie masz prawa.",
};

export default function PrivacyPage() {
  return (
    <LegalArticle script="Twoje dane" title="Polityka prywatności" updated={UPDATED}>
      <LegalSection title="1. Administrator">
        <p>Administratorem Twoich danych jest:</p>
        <LegalIdentity />
        <p>
          W sprawach danych pisz na{" "}
          <a href={`mailto:${site.email}`} className="text-gold hover:text-gold-light">
            {site.email}
          </a>
          . Nie wyznaczyliśmy inspektora ochrony danych.
        </p>
      </LegalSection>

      <LegalSection title="2. Jakie dane zbieramy">
        <p>Zależnie od tego, z czego korzystasz:</p>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>
            Konto: imię, nazwisko, e-mail, telefon, hasło (w formie zaszyfrowanej
            u dostawcy logowania), data akceptacji regulaminu i tej polityki.
          </li>
          <li>
            Uczestnicy: imię i nazwisko osoby dorosłej, partnera albo dziecka oraz
            rodzaj zajęć, którymi się interesujesz.
          </li>
          <li>
            Zapis i płatność: wybrane zajęcia, kwota, termin, status wpłaty,
            identyfikator płatności. Pełnego numeru karty nie zapisujemy.
          </li>
          <li>
            Formularz kontaktu: imię, telefon albo e-mail, temat i treść
            wiadomości.
          </li>
          <li>
            Techniczne: adres IP na czas ograniczenia liczby zgłoszeń (około 10
            minut, w pamięci serwera) oraz pliki cookie sesji, gdy jesteś
            zalogowany.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Po co i na jakiej podstawie">
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>
            Konto, zapis, grafik, przypomnienia i płatności — wykonanie umowy
            (art. 6 ust. 1 lit. b RODO).
          </li>
          <li>
            Faktury, księgowość i obowiązki podatkowe — obowiązek prawny (art. 6
            ust. 1 lit. c RODO).
          </li>
          <li>
            Formularz kontaktu — zgoda, którą zaznaczasz przed wysłaniem (art. 6
            ust. 1 lit. a RODO). Zgodę możesz cofnąć, co nie wpływa na
            zgodność przetwarzania sprzed cofnięcia.
          </li>
          <li>
            Ochrona przed nadużyciami, dochodzenie i obrona roszczeń —
            prawnie uzasadniony interes szkoły (art. 6 ust. 1 lit. f RODO).
          </li>
        </ul>
        <p>
          Nie sprzedajemy danych. Nie wysyłamy ofert obcych firm. Wiadomości o
          zajęciach i płatnościach wynikają z zapisu, nie z osobnej zgody
          marketingowej.
        </p>
      </LegalSection>

      <LegalSection title="4. Dzieci">
        <p>
          Konto zakłada osoba dorosła. Imię i nazwisko dziecka podaje rodzic albo
          opiekun, żeby prowadzić zajęcia i kontakt w sprawie grupy. Dziecko nie
          musi podawać własnego e-maila ani telefonu. Jeśli konto założy ktoś
          poniżej 16. roku życia bez opiekuna, usuniemy je po tym, jak się o tym
          dowiemy.
        </p>
      </LegalSection>

      <LegalSection title="5. Komu przekazujemy dane">
        <p>Dane trafiają tylko do podmiotów, które obsługują szkołę:</p>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>Supabase — baza danych i logowanie.</li>
          <li>Stripe — płatność kartą i link do zapłaty.</li>
          <li>Resend — wysyłka e-maili (zapis, płatność, konto).</li>
          <li>Vercel — hosting strony.</li>
          <li>
            Cloudflare Turnstile — sprawdzenie, że przy rejestracji i logowaniu
            nie pisze automat. Dostaje dane techniczne potrzebne do tej kontroli.
          </li>
          <li>
            Google — tylko gdy odtworzysz film osadzony z YouTube. Używamy trybu
            bez śledzących plików cookie, dopóki sam nie włączysz odtwarzania.
          </li>
        </ul>
        <p>
          Trenerzy szkoły widzą dane uczestników swojej grupy w zakresie
          potrzebnym do zajęć. Organom publicznym przekazujemy dane, gdy przepis
          tego wymaga.
        </p>
        <p>
          Część dostawców może przetwarzać dane poza Europejskim Obszarem
          Gospodarczym. Wtedy podstawą są standardowe klauzule umowne albo
          decyzja o adekwatności. Kartę obsługuje Stripe w modelu płatności dla
          odbiorców z Europy.
        </p>
      </LegalSection>

      <LegalSection title="6. Jak długo trzymamy dane">
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>
            Konto i zapisy — przez czas uczestnictwa, a potem do przedawnienia
            roszczeń, co do zasady przez 6 lat.
          </li>
          <li>
            Płatności i dokumenty księgowe — przez 5 lat od końca roku, w którym
            powstał obowiązek podatkowy, a dłużej, jeśli wymaga tego przepis albo
            toczy się sprawa.
          </li>
          <li>
            Wiadomość z formularza — do zakończenia sprawy, nie dłużej niż 3
            lata, chyba że przeszła w zapis albo rozliczenie.
          </li>
          <li>Adres IP przy limicie zgłoszeń — około 10 minut.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Twoje prawa">
        <p>Możesz poprosić o:</p>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>dostęp do danych i kopię,</li>
          <li>poprawienie danych,</li>
          <li>
            usunięcie albo ograniczenie przetwarzania — poza tym, co musimy
            zostawić z powodu rozliczeń albo roszczeń,
          </li>
          <li>przeniesienie danych przekazanych w związku z umową albo zgodą,</li>
          <li>
            sprzeciw wobec przetwarzania opartego na uzasadnionym interesie,
          </li>
          <li>cofnięcie zgody, jeśli na niej polegamy.</li>
        </ul>
        <p>
          Część danych poprawisz samodzielnie w koncie. Resztę załatwimy po
          wiadomości na {site.email}. Skargę możesz wnieść do Prezesa Urzędu
          Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa,{" "}
          <a
            href="https://uodo.gov.pl"
            className="text-gold hover:text-gold-light"
            target="_blank"
            rel="noopener noreferrer"
          >
            uodo.gov.pl
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Pliki cookie">
        <p>
          Sesja logowania korzysta z niezbędnych plików cookie. Bez nich konto
          nie zostaje zalogowane. Turnstile może zapisać techniczny plik cookie,
          żeby potwierdzić, że formularz wysyła człowiek. Nie używamy cookies
          analitycznych ani reklamowych, więc nie pytamy o zgodę na takie pliki.
        </p>
        <p>
          Linki do Instagrama i Facebooka prowadzą poza stronę. Ich serwisy mają
          własne zasady, które widzisz dopiero po przejściu.
        </p>
      </LegalSection>

      <LegalSection title="9. Czy musisz podać dane">
        <p>
          Dane konta, zapisu i płatności są potrzebne, żeby przyjąć Cię na
          zajęcia i je rozliczyć. Bez nich nie założymy konta i nie potwierdzimy
          miejsca. W formularzu kontaktu wystarczy telefon albo e-mail — jedno z
          dwojga — oraz zgoda opisana przy formularzu. Zasady zajęć są w{" "}
          <Link href="/regulamin" className="text-gold hover:text-gold-light">
            regulaminie
          </Link>
          .
        </p>
        <p>
          Politykę możemy uzupełnić, gdy zmieni się strona albo przepisy. Aktualna
          wersja jest zawsze pod tym adresem, z datą na górze.
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
