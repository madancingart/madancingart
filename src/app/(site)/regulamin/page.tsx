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

      <LegalSection title="4. Zajęcia, opłaty i rezygnacja">
        <p>
          Zasady zajęć, opłat, karnetu, nieobecności i rezygnacji są w{" "}
          <Link href="/regulamin-zajec" className="text-gold hover:text-gold-light">
            regulaminie zajęć
          </Link>{" "}
          i w{" "}
          <Link href="/umowa" className="text-gold hover:text-gold-light">
            umowie
          </Link>
          . Przy zapisie i przy płatności akceptujesz oba dokumenty. Opłata
          miesięczna albo karnet, termin do 10. dnia miesiąca, przelew na konto
          szkoły. Tej samej kwoty możesz dopłacić kartą na stronie albo gotówką
          na sali.
        </p>
      </LegalSection>

      <LegalSection title="5. Na sali">
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
          Zdjęcia i nagrania do materiałów szkoły publikujemy tylko za osobną
          zgodą osoby dorosłej albo rodzica dziecka. Ta zgoda nie jest warunkiem
          udziału w zajęciach.
        </p>
      </LegalSection>

      <LegalSection title="6. Odstąpienie od umowy zawartej na odległość">
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

      <LegalSection title="7. Reklamacje">
        <p>
          Reklamację wyślij na {site.email} albo zgłoś telefonicznie. Napisz,
          czego dotyczy i czego oczekujesz. Odpowiadamy w ciągu 14 dni. Brak
          odpowiedzi w tym terminie oznacza, że reklamację uznajemy.
        </p>
      </LegalSection>

      <LegalSection title="8. Treści strony i zmiany">
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
