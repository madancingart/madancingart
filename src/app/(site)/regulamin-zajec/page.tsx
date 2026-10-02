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
  title: "Regulamin zajęć — M&A Dancing Art",
  description:
    "Zasady uczestnictwa w zajęciach M&A Dancing Art: płatności, rezygnacja, nieobecności i bezpieczeństwo.",
};

export default function ClassTermsPage() {
  return (
    <LegalArticle script="Na sali" title="Regulamin zajęć" updated={UPDATED}>
      <LegalSection title="1. Kogo dotyczy">
        <LegalIdentity />
        <p>
          Regulamin dotyczy zajęć tanecznych szkoły. Udział — także dziecka —
          oznacza, że uczestnik albo rodzic lub opiekun go akceptuje. Przy
          zapisie i płatności akceptujesz też{" "}
          <Link href="/umowa" className="text-gold hover:text-gold-light">
            umowę
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Na zajęciach">
        <p>
          Przychodzisz punktualnie, w stroju do tańca i w obuwiu zmiennym. Osoba
          spóźniona może nie zostać wpuszczona na salę. Nagrywanie i
          fotografowanie bez zgody instruktora jest zabronione. Instruktor może
          wyprosić uczestnika, który zachowuje się niewłaściwie.
        </p>
        <p>Zajęcia trwają od 30 do 90 minut, według grafiku danej grupy.</p>
      </LegalSection>

      <LegalSection title="3. Opłaty">
        <p>
          Za zajęcia grupowe nie płaci się za pojedyncze wejście. Obowiązuje
          opłata miesięczna albo karnet. Termin płatności mija 10. dnia miesiąca.
          Karnet opłacasz do 10. dnia miesiąca albo przed pierwszymi zajęciami po
          zakończeniu poprzedniego karnetu. Karnet jest ważny 5 tygodni od daty
          najbliższych zajęć po wpłacie.
        </p>
        <p>
          Wpłatę robisz przelewem na konto {site.legal.bank}: {site.legal.account}.
          W tytule podaj imię i nazwisko uczestnika, rodzaj zajęć, liczbę wejść w
          tygodniu i miejscowość. Tę samą należność możesz opłacić kartą na
          stronie albo gotówką na sali. Brak wpłaty w terminie może oznaczać
          odmowę udziału w zajęciach.
        </p>
        <p>
          Opłata za rozpoczęty miesiąc albo opłacony karnet nie podlega zwrotowi.
          Nieobecność na zajęciach, które się odbyły, nie obniża tej opłaty.
        </p>
      </LegalSection>

      <LegalSection title="4. Rezygnacja i nieobecność">
        <p>
          Rezygnację zgłoś do końca bieżącego miesiąca SMS-em na numer {site.phone}.
          Rezygnacja po rozpoczęciu nowego miesiąca oznacza, że ten miesiąc
          zostaje do opłacenia.
        </p>
        <p>
          Nieobecność trwająca co najmniej miesiąc, zgłoszona zanim ten okres się
          zacznie, zwalnia z opłaty za ten czas.
        </p>
        <p>
          Odrabianie w innej grupie jest możliwe, ale szkoła nie ma takiego
          obowiązku. Odwołane przez szkołę zajęcia mogą zostać odrobione — też
          bez takiego obowiązku. Grupa może zostać rozwiązana, gdy zostanie w
          niej mniej niż 4 osoby.
        </p>
      </LegalSection>

      <LegalSection title="5. Bezpieczeństwo">
        <p>
          Uczestnik albo rodzic oświadcza, że nie ma przeciwwskazań zdrowotnych
          do zajęć ruchowych. Chorobę i kontuzję zgłaszasz instruktorowi przed
          zajęciami. Szkoła może odmówić udziału ze względów bezpieczeństwa.
          Za szkodę wyrządzoną z winy szkoły odpowiadamy na zasadach kodeksu
          cywilnego.
        </p>
        <p>
          Po zakończeniu zajęć dziecko odbiera rodzic albo opiekun, punktualnie.
          Samodzielny powrót dziecka jest możliwy tylko za zgodą rodzica i na
          jego odpowiedzialność. Do tego momentu po zajęciach opiekę sprawuje
          rodzic.
        </p>
        <p>
          Uczestnik albo rodzic odpowiada za szkody i zniszczenia, które spowoduje,
          i pokrywa koszt naprawy albo wymiany.
        </p>
      </LegalSection>

      <LegalSection title="6. Wizerunek i dane">
        <p>
          Dane do zapisu i rozliczeń przetwarzamy tak, jak opisuje{" "}
          <Link
            href="/polityka-prywatnosci"
            className="text-gold hover:text-gold-light"
          >
            polityka prywatności
          </Link>
          . Publikacja zdjęć i nagrań w materiałach szkoły jest osobną zgodą.
          Nie jest warunkiem udziału w zajęciach i można ją cofnąć, pisząc na{" "}
          {site.email}.
        </p>
      </LegalSection>

      <LegalSection title="7. Koniec współpracy">
        <p>
          Szkoła może rozwiązać umowę ze skutkiem natychmiastowym, gdy uczestnik
          albo rodzic łamie ten regulamin albo umowę. Sprawy nieopisane tutaj
          rozstrzygamy według prawa polskiego, w tym kodeksu cywilnego.
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
