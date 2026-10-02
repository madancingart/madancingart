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
  title: "Regulamin — M&A Dancing Art",
  description:
    "Regulamin szkoły tańca M&A Dancing Art: zapisy, opłaty, konto, rezygnacja i reklamacje.",
};

export default function TermsPage() {
  return (
    <LegalArticle script="Zasady" title="Regulamin" updated={UPDATED}>
      <LegalSection title="1. Kto prowadzi szkołę">
        <LegalIdentity />
        <p>
          Szkoła działa pod nazwą {site.name}. Zajęcia odbywają się w Mikołowie (
          {site.locations[0].address}) i w Lublińcu ({site.locations[1].address}).
        </p>
        <p>
          Regulamin określa zasady korzystania ze strony, konta, zapisów i zajęć.
          Zapisując się albo zakładając konto, akceptujesz go. Ceny podajemy na{" "}
          <Link href="/cennik" className="text-gold hover:text-gold-light">
            cenniku
          </Link>
          . Kwotę konkretnego zapisu liczymy po stronie serwera z tego cennika i
          pokazujemy przed płatnością.
        </p>
      </LegalSection>

      <LegalSection title="2. Strona i konto">
        <p>
          Na stronie znajdziesz ofertę, grafik, cennik i formularz kontaktu. Konto
          służy do zapisu, podglądu zajęć, uczestników i płatności.
        </p>
        <p>
          Konto zakładasz na prawdziwe imię, nazwisko, e-mail i telefon oraz hasło.
          Możesz dopisać siebie, parę albo dziecko. Dane partnera lub dziecka
          podajesz tylko wtedy, gdy te osoby naprawdę biorą udział w zajęciach.
          Za dziecko zapisuje się rodzic albo opiekun — dziecko nie zakłada konta
          samo.
        </p>
        <p>
          Hasło jest Twoje. Dostęp do konta możesz dostać linkiem z e-maila. Konto
          usuniemy na prośbę wysłaną na {site.email}, z wyjątkiem danych, które
          musimy zostawić do rozliczeń albo obrony roszczeń. Szczegóły są w{" "}
          <Link href="/polityka-prywatnosci" className="text-gold hover:text-gold-light">
            polityce prywatności
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="3. Zapis">
        <p>
          Miejsce wybierasz w{" "}
          <Link href="/grafik" className="text-gold hover:text-gold-light">
            grafiku
          </Link>{" "}
          albo przez konto. Zapis jest przyjęty, gdy go potwierdzimy — w koncie,
          mailem albo telefonicznie. Samo wysłanie formularza nie gwarantuje
          miejsca, jeśli grupa jest pełna albo termin już nie jest wolny.
        </p>
        <p>
          Nowy zapis, za który nie wpłynie płatność, trzymamy 72 godziny. Po tym
          czasie miejsce wraca do puli. Dostaniesz o tym wiadomość, jeśli mamy
          Twój e-mail.
        </p>
      </LegalSection>

      <LegalSection title="4. Zajęcia grupowe">
        <p>
          Opłata miesięczna obejmuje zajęcia z grafiku w danym miesiącu. Pełny
          miesiąc rozliczamy z góry: informację o kwocie wysyłamy około 20. dnia
          poprzedniego miesiąca, a termin płatności mija 5. dnia miesiąca, którego
          dotyczy opłata.
        </p>
        <p>
          Pierwsza wpłata po zapisie jest naliczana od razu i płatna w ciągu 4
          dni. Jeśli w bieżącym miesiącu zostały mniej niż dwa zajęcia, pierwsza
          kwota obejmuje resztę tego miesiąca i kolejny pełny miesiąc. Niepełny
          miesiąc liczymy proporcjonalnie do liczby zajęć, które są w grafiku.
        </p>
        <p>
          Jeśli na stronie jest przedpłata za kilka miesięcy, jedna wpłata pokrywa
          ten okres. Za miesiące objęte już potwierdzoną przerwą albo rezygnacją
          złożoną w terminie z punktu 7 zwracamy nadpłatę.
        </p>
        <p>
          Nieobecność uczestnika nie obniża opłaty za zajęcia, które się odbyły.
          Zajęcia odwołane przez szkołę odpadają z rozliczenia tego miesiąca.
        </p>
      </LegalSection>

      <LegalSection title="5. Karnet">
        <p>
          Tam, gdzie cennik przewiduje karnet, obejmuje on 4 wejścia na wskazane
          zajęcia. Wejście schodzi, gdy zajęcia się odbyły i uczestnik był na nie
          zapisany. Gdy zostaje ostatnie wejście, dostaniesz informację o kolejnym
          karnecie. Nowy karnet zaczyna się po opłaceniu.
        </p>
      </LegalSection>

      <LegalSection title="6. Lekcje indywidualne i pierwszy taniec">
        <p>
          Lekcja i pakiet godzin (także pierwszy taniec) są płatne z góry, według
          cennika. Termin umawiasz ze szkołą. Godzinę przekładasz, pisząc albo
          dzwoniąc najpóźniej dzień przed lekcją. Późniejsze odwołanie albo
          nieobecność bez wiadomości oznacza, że godzina jest wykorzystana.
        </p>
        <p>
          Niewykorzystane godziny pakietu nie przepadają tylko dlatego, że minął
          czas — umawiasz je dalej ze szkołą. Jeśli rezygnujesz z reszty pakietu,
          rozliczamy godziny, które zostały, po cenie pojedynczej lekcji z cennika
          i zwracamy różnicę wobec wpłaconej kwoty.
        </p>
      </LegalSection>

      <LegalSection title="7. Płatności, przerwa, rezygnacja">
        <p>
          Płacisz online (karta, przez Stripe), gotówką na sali albo przelewem.
          Przy płatności online operatorem płatności jest Stripe. Szkoła nie
          zapisuje pełnego numeru karty.
        </p>
        <p>
          Po terminie przypomnimy o wpłacie. Jeśli coś się zmieniło i nie chodzisz
          na zajęcia, odpisz — zamkniemy zapis i przestaniemy przypominać.
        </p>
        <p>
          Przerwę (wyjazd, kontuzja, inna przerwa) zgłaszasz mailem albo
          telefonicznie. Obowiązuje od dat, które szkoła potwierdzi. Za
          potwierdzoną przerwę nie wystawiamy opłaty miesięcznej.
        </p>
        <p>
          Rezygnację ze stałego zapisu zgłaszasz mailem albo telefonicznie. Jeśli
          zrobisz to do 20. dnia miesiąca, zapis kończy się z końcem tego miesiąca
          i kolejnego już nie rozliczamy. Zgłoszenie po 20. dniu zamyka zapis z
          końcem następnego miesiąca — ten następny miesiąc zostaje do opłacenia,
          jeśli zajęcia są w grafiku.
        </p>
      </LegalSection>

      <LegalSection title="8. Na sali">
        <p>
          Na zajęcia przychodzisz w stroju i obuwiu do tańca, na czas. O kontuzji
          albo przeciwwskazaniu do wysiłku mówisz trenerowi przed zajęciami.
          Szkoła nie zastępuje porady lekarskiej i odpowiada za szkodę na zasadach
          kodeksu cywilnego.
        </p>
        <p>
          Dziecko zostaje pod opieką trenera w czasie zajęć. Przed i po zajęciach
          opieka należy do rodzica albo osoby, którą rodzic wskaże. Numer telefonu
          na koncie ma być numerem, pod którym da się Was złapać.
        </p>
        <p>
          Zdjęcia i nagrania z zajęć publikujemy tylko za zgodą osoby dorosłej
          albo rodzica dziecka. Zgoda nie jest warunkiem udziału w zajęciach.
        </p>
      </LegalSection>

      <LegalSection title="9. Odstąpienie od umowy zawartej na odległość">
        <p>
          Umowę zawartą przez stronę albo konto możesz odstąpić w ciągu 14 dni
          bez podania przyczyny. Wystarczy wiadomość na {site.email}. Termin
          liczymy od dnia zawarcia umowy.
        </p>
        <p>
          Prawo odstąpienia nie przysługuje, gdy w umowie jest oznaczony dzień
          albo okres usługi związanej z wydarzeniem sportowym lub rekreacyjnym —
          tak jest przy konkretnej lekcji, karnecie na oznaczone zajęcia i
          miesiącu z grafiku. Jeśli prosisz, żeby zajęcia zaczęły się przed
          upływem 14 dni, potwierdzasz rozpoczęcie usługi. Za część już wykonaną
          zapłata zostaje należna, a niewykonaną część rozliczamy jak przy
          rezygnacji.
        </p>
      </LegalSection>

      <LegalSection title="10. Reklamacje">
        <p>
          Reklamację wyślij na {site.email} albo zgłoś telefonicznie. Napisz,
          czego dotyczy i czego oczekujesz. Odpowiadamy w ciągu 14 dni. Brak
          odpowiedzi w tym terminie oznacza, że reklamację uznajemy.
        </p>
      </LegalSection>

      <LegalSection title="11. Treści strony i zmiany">
        <p>
          Teksty, zdjęcia i układ strony należą do szkoły albo są używane za
          zgodą. Możesz z nich korzystać na własny użytek. Nie kopiujesz ich na
          inne strony ani do materiałów szkoły tańca bez zgody.
        </p>
        <p>
          Cennik i regulamin możemy zmienić. Nowa cena albo nowy regulamin
          obowiązuje przyszłe miesiące i nowe zapisy. O zmianie, która dotyczy
          Twojego stałego zapisu, napiszemy mailem co najmniej 14 dni wcześniej.
          Do tego czasu możesz zrezygnować bez opłaty za okres po wejściu zmiany.
        </p>
        <p>
          Sprawy nieopisane tutaj rozstrzygamy według prawa polskiego. Konsumenci
          mogą skorzystać z pomocy rzecznika konsumentów i z platformy ODR
          Komisji Europejskiej. Sąd właściwy wynika z przepisów — postanowień,
          które odbierałyby Ci ten wybór, tu nie ma.
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
