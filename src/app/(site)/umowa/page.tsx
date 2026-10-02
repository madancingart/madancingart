import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle, LegalSection } from "@/components/legal/LegalArticle";
import { site } from "@/content/site";

const UPDATED = "2 października 2026";

export const metadata: Metadata = {
  title: "Umowa o zajęcia — M&A Dancing Art",
  description:
    "Umowa o prowadzenie zajęć tanecznych w M&A Dancing Art: opłaty, karnet, rezygnacja i odbiór dziecka.",
};

export default function ContractPage() {
  return (
    <LegalArticle script="Zapis" title="Umowa o zajęcia" updated={UPDATED}>
      <LegalSection title="Strony">
        <p>
          Umowę zawiera szkoła — <LegalIdentityInline /> — z pełnoletnim
          uczestnikiem albo z rodzicem lub opiekunem prawnym dziecka. Dane
          uczestnika, a przy dziecku także imię, nazwisko i data urodzenia,
          pochodzą z konta albo z formularza zapisu.
        </p>
        <p>
          Umowa jest na czas nieokreślony. Zawierasz ją, zaznaczając akceptację
          przy zapisie albo przy płatności na stronie. Zasady sali są w{" "}
          <Link href="/regulamin-zajec" className="text-gold hover:text-gold-light">
            regulaminie zajęć
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="1. Zajęcia">
        <p>
          Szkoła prowadzi zajęcia według aktualnego grafiku. Uczestnik bierze w
          nich udział w wybranym rodzaju zajęć. Zajęcia trwają od 30 do 90 minut.
          Obowiązuje strój i obuwie zmienne. Niewłaściwe zachowanie kończy się
          wyproszeniem z zajęć.
        </p>
        <p>
          Grupa może zostać rozwiązana, gdy zostanie w niej mniej niż 4 osoby.
          Odrabianie w innej grupie jest możliwe, ale nieobowiązkowe.
        </p>
      </LegalSection>

      <LegalSection title="2. Płatność">
        <p>
          Nie opłaca się pojedynczych wejść. Obowiązuje opłata miesięczna albo
          karnet. Termin mija 10. dnia każdego miesiąca albo — przy karnecie —
          przed pierwszymi zajęciami po zakończeniu ważności poprzedniego
          karnetu. Karnet jest ważny 5 tygodni od daty najbliższych zajęć po
          wpłacie.
        </p>
        <p>
          Przelew: {site.legal.bank}, {site.legal.account}. Tytuł: imię i nazwisko
          uczestnika, rodzaj zajęć, liczba wejść w tygodniu, miejscowość. Kartą
          na stronie albo gotówką na sali rozliczasz tę samą należność. Szkoła
          nie zapisuje pełnego numeru karty.
        </p>
        <p>
          Brak płatności w terminie może oznaczać odmowę udziału. Opłaty nie
          podlegają zwrotowi.
        </p>
      </LegalSection>

      <LegalSection title="3. Rezygnacja">
        <p>
          Rezygnację zgłoś SMS-em na {site.phone} do końca bieżącego miesiąca.
          Zgłoszenie po rozpoczęciu nowego miesiąca zobowiązuje do opłaty za ten
          miesiąc. Nieobecność trwająca co najmniej miesiąc, zgłoszona przed jej
          rozpoczęciem, nie jest płatna.
        </p>
      </LegalSection>

      <LegalSection title="4. Zdrowie i dziecko">
        <p>
          Uczestnik albo rodzic oświadcza, że nie ma przeciwwskazań zdrowotnych
          do udziału w zajęciach. Choroby i kontuzje zgłasza instruktorowi.
          Szkoła może odmówić udziału ze względów bezpieczeństwa. Za szkodę z
          winy szkoły odpowiadamy według kodeksu cywilnego.
        </p>
        <p>
          Po zajęciach dziecko odbiera rodzic, punktualnie. Jeśli rodzic zgadza
          się na samodzielny powrót dziecka, bierze za to odpowiedzialność.
        </p>
      </LegalSection>

      <LegalSection title="5. Dane i wizerunek">
        <p>
          Dane przetwarzamy według{" "}
          <Link
            href="/polityka-prywatnosci"
            className="text-gold hover:text-gold-light"
          >
            polityki prywatności
          </Link>
          . Zgoda na zdjęcia i nagrania do materiałów promocyjnych jest osobna.
          Nie jest warunkiem zawarcia tej umowy.
        </p>
      </LegalSection>

      <LegalSection title="6. Postanowienia końcowe">
        <p>
          Uczestnik albo rodzic przestrzega regulaminu zajęć. Szkoła może
          rozwiązać umowę natychmiast, gdy regulamin albo umowa są łamane. W
          sprawach nieopisanych stosuje się kodeks cywilny.
        </p>
      </LegalSection>
    </LegalArticle>
  );
}

function LegalIdentityInline() {
  return (
    <>
      {site.legal.name}, {site.legal.address}, NIP {site.legal.nip}
    </>
  );
}
