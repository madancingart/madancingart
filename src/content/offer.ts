import type { StaticImageData } from "next/image";
import dzieci47 from "@/assets/offer/dzieci-4-7.jpg";
import dzieci814 from "@/assets/offer/dzieci-8-14.jpg";
import indywidualne from "@/assets/offer/indywidualne.jpg";
import latinoMlodziez from "@/assets/offer/latino-mlodziez.jpg";
import latinoPanie from "@/assets/offer/latino-panie.jpg";
import pierwszyTaniec from "@/assets/offer/pierwszy-taniec.jpg";
import pokazy from "@/assets/offer/pokazy.jpg";
import proAm from "@/assets/offer/pro-am.jpg";
import taniecUzytkowy from "@/assets/offer/taniec-uzytkowy.jpg";
import type { LocationId } from "@/content/site";

const bothLocations: LocationId[] = ["mikolow", "lubliniec"];

export type OfferItem = {
  slug: string;
  name: string;
  scriptPhrase: string;
  shortDesc: string;
  longDesc: string[];
  audience: string;
  highlights: string[];
  image: StaticImageData;
  gallery?: string[];
  locations: LocationId[];
  ctaLabel: string;
};

export const offerItems: OfferItem[] = [
  {
    slug: "pierwszy-taniec-weselny",
    name: "Pierwszy taniec weselny",
    scriptPhrase: "Wasza chwila",
    shortDesc:
      "Choreografia dopasowana do marzeń pary — od romantycznego walca po efektowne show w stylu Dirty Dancing.",
    longDesc: [
      "Szyjemy choreografię na miarę: pod Wasz charakter, wybraną muzykę i realne możliwości. Może to być spokojny, romantyczny walc albo widowiskowe wejście w stylu Dirty Dancing — decyzja należy do Was.",
      "Wspieramy Was od pierwszych kroków aż po finalne dopracowanie na parkiecie. Prowadzimy parę krok po kroku, bez pośpiechu i bez porównań z kimkolwiek innym.",
      "Cały proces ma być przyjemnością i piękną pamiątką z przygotowań do ślubu — nie źródłem stresu. Terminy dopasowujemy do Waszego kalendarza.",
    ],
    audience: "Pary narzeczonych i młode małżeństwa",
    highlights: [
      "choreografia na miarę",
      "wsparcie krok po kroku",
      "bez stresu i presji",
      "terminy dopasowane do pary",
    ],
    image: pierwszyTaniec,
    locations: bothLocations,
    ctaLabel: "Porozmawiajmy o terminie",
  },
  {
    slug: "taniec-uzytkowy",
    name: "Taniec użytkowy dla par",
    scriptPhrase: "We dwoje",
    shortDesc:
      "Swoboda na parkiecie podczas wesel i imprez — kroki, prowadzenie w parze i komunikacja między partnerami.",
    longDesc: [
      "Taniec użytkowy uczy swobody na parkiecie: na weselu, imprezie rodzinnej czy wieczorze ze znajomymi. Nie chodzi o show, tylko o to, żeby tańczyć razem z przyjemnością.",
      "Ćwiczymy podstawowe kroki, prowadzenie w parze i komunikację między partnerami. Nie trzeba mieć wcześniejszego doświadczenia — zaczynamy od zera.",
      "Zajęcia to też wspólny czas. Taniec buduje relację, zaufanie i poczucie, że na parkiecie jesteście drużyną.",
    ],
    audience: "Pary, także bez wcześniejszego doświadczenia",
    highlights: [
      "swoboda na weselach i imprezach",
      "kroki i prowadzenie w parze",
      "komunikacja między partnerami",
      "bez wcześniejszego doświadczenia",
    ],
    image: taniecUzytkowy,
    locations: bothLocations,
    ctaLabel: "Zapisz się",
  },
  {
    slug: "latino-solo",
    name: "Latino solo dla pań",
    scriptPhrase: "Twoja energia",
    shortDesc:
      "Energia tańców latynoamerykańskich — praca z ciałem, rytm, koordynacja, pewność siebie, sylwetka i kondycja.",
    longDesc: [
      "Latino solo to energia tańców latynoamerykańskich bez konieczności tańczenia z partnerem. Pracujemy z ciałem, rytmem i koordynacją — tak, żeby ruch był świadomy i przyjemny.",
      "Zajęcia budują pewność siebie, pomagają dbać o sylwetkę i kondycję. Intensywność dopasowujemy do grupy, nie do wyścigu.",
      "To propozycja dla kobiet w każdym wieku. Nie trzeba znać kroków ani mieć pary — wystarczy chęć wejścia na parkiet.",
    ],
    audience: "Kobiety w każdym wieku, bez partnera",
    highlights: [
      "energia tańców latynoamerykańskich",
      "praca z ciałem, rytm i koordynacja",
      "pewność siebie, sylwetka i kondycja",
      "bez partnera, w każdym wieku",
    ],
    image: latinoPanie,
    locations: bothLocations,
    ctaLabel: "Zapisz się",
  },
  {
    slug: "latino-solo-mlodziez",
    name: "Latino solo dla młodzieży",
    scriptPhrase: "Twój rytm",
    shortDesc:
      "Energia, muzyka, koordynacja i swoboda ruchu — luźna, motywująca atmosfera z naciskiem na realny progres.",
    longDesc: [
      "Na latino solo dla młodzieży liczy się energia, muzyka, koordynacja i swoboda ruchu. Tańczymy tak, żeby było dynamicznie, ale z jasnym celem.",
      "Atmosfera jest luźna i motywująca — bez zbędnej presji, z naciskiem na realny progres. Każdy ma szansę iść do przodu we własnym tempie.",
      "To zajęcia, na które chce się wracać: dużo ruchu, konkretna praca i satysfakcja z tego, że z tygodnia na tydzień wychodzi coraz lepiej.",
    ],
    audience: "Młodzież",
    highlights: [
      "energia, muzyka i koordynacja",
      "swoboda ruchu",
      "luźna, motywująca atmosfera",
      "nacisk na realny progres",
    ],
    image: latinoMlodziez,
    locations: bothLocations,
    ctaLabel: "Zapisz się",
  },
  {
    slug: "dzieci-4-7",
    name: "Zajęcia dla dzieci 4–7 lat",
    scriptPhrase: "Radość ruchu",
    shortDesc:
      "Ruch, zabawa i radość — forma zabawowa, bez presji, z dbałością o każde dziecko.",
    longDesc: [
      "Najmłodszych zapraszamy do świata tańca przez ruch, zabawę i radość. Zajęcia mają formę zabawową, bez presji na wynik i bez porównywania dzieci ze sobą.",
      "Ćwiczymy koordynację, równowagę, rytm i orientację w przestrzeni — wszystko w tempie, które dziecko jest w stanie udźwignąć.",
      "Każde dziecko jest zauważone i zaakceptowane. Zależy nam, żeby maluch wychodził z sali z uśmiechem i chęcią powrotu.",
    ],
    audience: "Dzieci w wieku 4–7 lat",
    highlights: [
      "ruch, zabawa i radość",
      "forma zabawowa, bez presji",
      "koordynacja, równowaga, rytm",
      "każde dziecko zauważone i zaakceptowane",
    ],
    image: dzieci47,
    locations: bothLocations,
    ctaLabel: "Zapisz się",
  },
  {
    slug: "dzieci-8-14",
    name: "Zajęcia dla dzieci 8–14 lat",
    scriptPhrase: "Razem na parkiecie",
    shortDesc:
      "Dobra zabawa i systematyczny rozwój taneczny — koordynacja, rytmika, technika i praca w grupie.",
    longDesc: [
      "W grupie 8–14 lat łączymy dobrą zabawę z systematycznym rozwojem tanecznym. Dzieci uczą się koordynacji, rytmiki, techniki, pracy w grupie i prawidłowej postawy.",
      "Stopniowo wprowadzamy elementy dyscypliny — tyle, ile potrzeba, żeby grupa mogła iść do przodu, bez odbierania radości z tańca.",
      "Zajęcia przygotowują zarówno do rozwoju rekreacyjnego, jak i sportowego. Dalszą drogę dopasowujemy do predyspozycji i chęci dziecka.",
    ],
    audience: "Dzieci w wieku 8–14 lat",
    highlights: [
      "zabawa i systematyczny rozwój",
      "koordynacja, rytmika, technika",
      "praca w grupie i prawidłowa postawa",
      "przygotowanie rekreacyjne lub sportowe",
    ],
    image: dzieci814,
    locations: bothLocations,
    ctaLabel: "Zapisz się",
  },
  {
    slug: "lekcje-indywidualne",
    name: "Lekcje indywidualne",
    scriptPhrase: "Tylko Ty",
    shortDesc:
      "Praca 1:1 z trenerem pod konkretne cele — technika, choreografia, turnieje, pierwszy taniec lub rekreacja.",
    longDesc: [
      "Lekcje indywidualne to praca jeden na jeden z trenerem, podporządkowana Twoim celom: technice, choreografii, startom turniejowym, pierwszemu tańcowi albo zwykłej rekreacji.",
      "Taka forma daje maksymalną efektywność — cały czas zajęć jest Twój. Tempo, repertuar i poziom ustalamy na bieżąco.",
      "Terminy są elastyczne. Układamy graf tak, żeby dało się pogodzić taniec z pracą, szkołą i resztą życia.",
    ],
    audience: "Osoby w każdym wieku i na każdym poziomie",
    highlights: [
      "praca 1:1 z trenerem",
      "cele dopasowane do Ciebie",
      "maksymalna efektywność",
      "elastyczne terminy",
    ],
    image: indywidualne,
    locations: bothLocations,
    ctaLabel: "Zapisz się",
  },
  {
    slug: "pro-am",
    name: "Pro-Am",
    scriptPhrase: "Na parkiecie",
    shortDesc:
      "Formuła jak w „Tańcu z Gwiazdami” — trening w parze z profesjonalnym tancerzem lub tancerką.",
    longDesc: [
      "Pro-Am to formuła znana z „Tańca z Gwiazdami”: trenujesz w parze z profesjonalnym tancerzem lub tancerką. Program jest dla panów i dla pań.",
      "Możesz startować w zawodach albo trenować wyłącznie dla siebie — bez presji na wynik, z pełnym zaangażowaniem po naszej stronie.",
      "Łączymy profesjonalizm i prestiż z naprawdę dobrą zabawą. To intensywna, satysfakcjonująca droga na parkiet.",
    ],
    audience: "Panie i panowie",
    highlights: [
      "trening z profesjonalnym partnerem",
      "dla panów i pań",
      "zawody albo trening dla siebie",
      "profesjonalizm, prestiż i świetna zabawa",
    ],
    image: proAm,
    locations: bothLocations,
    ctaLabel: "Zapisz się",
  },
  {
    slug: "pokazy",
    name: "Pokazy taneczne",
    scriptPhrase: "Na scenie",
    shortDesc:
      "Uatrakcyjnienie imprez, eventów firmowych, wesel i jubileuszy — od eleganckiego pokazu po mini-kurs dla gości.",
    longDesc: [
      "Pokaz taneczny uatrakcyjnia imprezę, event firmowy, wesele albo jubileusz. Dobieramy formę do okazji i gości.",
      "Może to być elegancki, kameralny pokaz, dynamiczne show albo występ połączony z mini-kursem dla zaproszonych osób.",
      "Wszystko jest do dogadania: długość, styl, muzyka i logistyka. Najpierw rozmawiamy, potem przygotowujemy propozycję.",
    ],
    audience: "Pary młode, firmy i organizatorzy eventów",
    highlights: [
      "wesela, eventy i jubileusze",
      "elegancki pokaz lub dynamiczne show",
      "opcja mini-kursu dla gości",
      "wszystko do dogadania",
    ],
    image: pokazy,
    locations: bothLocations,
    ctaLabel: "Porozmawiajmy o terminie",
  },
];

export function getOfferBySlug(slug: string): OfferItem | undefined {
  return offerItems.find((item) => item.slug === slug);
}

export function offerCtaHref(item: OfferItem): string {
  if (item.slug === "pierwszy-taniec-weselny" || item.slug === "pokazy") {
    return "/kontakt";
  }

  return "/grafik";
}
