/**
 * Jak dodać zdjęcie do galerii:
 * 1. Wstaw oryginał do `images-src/` (katalog jest w .gitignore).
 * 2. Uruchom: `npm run images -- gallery/<kategoria>`
 *    kategorie folderów: turnieje | zajecia | sale | pokazy
 * 3. Zaimportuj wynikowy JPEG z `src/assets/gallery/<kategoria>/` poniżej
 *    i dopisz wpis w odpowiedniej tablicy.
 */
import type { StaticImageData } from "next/image";
import pokazParaStandard from "@/assets/gallery/pokazy/92ac4275-b27d-4960-97c9-7125dc76fd66.jpg";
import pokazImg1945 from "@/assets/gallery/pokazy/img-1945.jpg";
import pokazImg5339 from "@/assets/gallery/pokazy/img-5339.jpg";
import pokazPierwszyTaniec1 from "@/assets/gallery/pokazy/pierwszy-taniec-1.jpg";
import pokazPierwszyTaniec2 from "@/assets/gallery/pokazy/pierwszy-taniec-2.jpg";
import pokaz1 from "@/assets/gallery/pokazy/pokazy-1.jpg";
import pokaz2 from "@/assets/gallery/pokazy/pokazy-2.jpg";
import salaImg0694 from "@/assets/gallery/sale/img-0694.jpg";
import salaLubliniec from "@/assets/gallery/sale/lubliniec.jpg";
import salaMikolowElewacja from "@/assets/gallery/sale/mikolow-elewacja.jpg";
import salaMikolow from "@/assets/gallery/sale/mikolow-sala.jpg";
import salaMikolowParkiet from "@/assets/gallery/sale/mikolow-parkiet.jpg";
import turniejImg0698 from "@/assets/gallery/turnieje/img-0698.jpg";
import turniejImg0699 from "@/assets/gallery/turnieje/img-0699.jpg";
import turniejImg1946 from "@/assets/gallery/turnieje/img-1946.jpg";
import turniejImg1947 from "@/assets/gallery/turnieje/img-1947.jpg";
import turniejImg4567 from "@/assets/gallery/turnieje/img-4567.jpg";
import turniejImg4569 from "@/assets/gallery/turnieje/img-4569.jpg";
import turniejMikolaj1 from "@/assets/gallery/turnieje/mikolaj-turniej-1.jpg";
import turniejMikolaj2 from "@/assets/gallery/turnieje/mikolaj-turniej-2.jpg";
import turniejOlaMikolaj from "@/assets/gallery/turnieje/ola-mikolaj.jpg";
import zajeciaDzieci from "@/assets/gallery/zajecia/dzieci.jpg";
import zajeciaLatino from "@/assets/gallery/zajecia/latino-solo.jpg";
import zajeciaLatino2 from "@/assets/gallery/zajecia/latino-solo-2.jpg";
import zajeciaLatino3 from "@/assets/gallery/zajecia/latino-solo-3.jpg";
import zajeciaLatino4 from "@/assets/gallery/zajecia/latino-solo-4.jpg";
import zajeciaLatino5 from "@/assets/gallery/zajecia/latino-solo-5.jpg";
import zajeciaLatino6 from "@/assets/gallery/zajecia/latino-solo-6.jpg";
import zajeciaUzytkowy1 from "@/assets/gallery/zajecia/taniec-uzytkowy-1.jpg";
import zajeciaUzytkowy2 from "@/assets/gallery/zajecia/taniec-uzytkowy-2.jpg";
import zajeciaUzytkowy3 from "@/assets/gallery/zajecia/taniec-uzytkowy-3.jpg";

export const GALLERY_CATEGORIES = [
  { id: "turnieje", label: "Turnieje" },
  { id: "zajecia", label: "Zajęcia" },
  { id: "sale", label: "Sale" },
  { id: "pokazy", label: "Pokazy" },
] as const;

export const GALLERY_FILTERS = [
  { id: "wszystkie", label: "Wszystkie" },
  ...GALLERY_CATEGORIES,
] as const;

export type GalleryCategoryId = (typeof GALLERY_CATEGORIES)[number]["id"];
export type GalleryFilterId = (typeof GALLERY_FILTERS)[number]["id"];

export type GalleryImage = {
  id: string;
  src: StaticImageData;
  alt: string;
  category: GalleryCategoryId;
};

export const turnieje: GalleryImage[] = [
  {
    id: "turnieje-mikolaj-2",
    src: turniejMikolaj2,
    alt: "Para latino na parkiecie turniejowym — tancerka w niebieskiej sukni z frędzlami",
    category: "turnieje",
  },
  {
    id: "turnieje-mikolaj-1",
    src: turniejMikolaj1,
    alt: "Para latino w dynamicznej pozie turniejowej — tancerka w czerwonej sukni",
    category: "turnieje",
  },
  {
    id: "turnieje-img-0699",
    src: turniejImg0699,
    alt: "Para w tańcu standardowym na parkiecie turniejowym",
    category: "turnieje",
  },
  {
    id: "turnieje-img-0698",
    src: turniejImg0698,
    alt: "Para latino w dynamicznej pozie na zawodach",
    category: "turnieje",
  },
  {
    id: "turnieje-img-4567",
    src: turniejImg4567,
    alt: "Tancerka w turkusowej sukience z piórami w parze na turnieju",
    category: "turnieje",
  },
  {
    id: "turnieje-img-4569",
    src: turniejImg4569,
    alt: "Para latino na parkiecie — tancerka w zielonej sukience z piórami",
    category: "turnieje",
  },
  {
    id: "turnieje-img-1946",
    src: turniejImg1946,
    alt: "Tancerka latino w pomarańczowym stroju na zawodach",
    category: "turnieje",
  },
  {
    id: "turnieje-img-1947",
    src: turniejImg1947,
    alt: "Tancerka latino w pomarańczowym stroju na parkiecie turniejowym",
    category: "turnieje",
  },
  {
    id: "turnieje-ola-mikolaj",
    src: turniejOlaMikolaj,
    alt: "Aleksandra Janosz i Mikołaj Mazur — para latino w czerwonej sukni",
    category: "turnieje",
  },
];

export const zajecia: GalleryImage[] = [
  {
    id: "zajecia-dzieci",
    src: zajeciaDzieci,
    alt: "Zajęcia dla dzieci w sali M&A Dancing Art — instruktor z grupą dziewczynek przy lustrze",
    category: "zajecia",
  },
  {
    id: "zajecia-latino-solo",
    src: zajeciaLatino,
    alt: "Zajęcia latino solo — grupa pań z instruktorem przy lustrze",
    category: "zajecia",
  },
  {
    id: "zajecia-latino-solo-2",
    src: zajeciaLatino2,
    alt: "Zajęcia latino solo w sali szkoły tańca w Mikołowie",
    category: "zajecia",
  },
  {
    id: "zajecia-latino-solo-3",
    src: zajeciaLatino3,
    alt: "Tancerka latino w pomarańczowej sukni na parkiecie",
    category: "zajecia",
  },
  {
    id: "zajecia-uzytkowy-2",
    src: zajeciaUzytkowy2,
    alt: "Para w tańcu użytkowym na parkiecie podczas imprezy",
    category: "zajecia",
  },
  {
    id: "zajecia-uzytkowy-1",
    src: zajeciaUzytkowy1,
    alt: "Uczestnicy zajęć tańca użytkowego na imprezie tanecznej",
    category: "zajecia",
  },
  {
    id: "zajecia-uzytkowy-3",
    src: zajeciaUzytkowy3,
    alt: "Para w tańcu użytkowym na imprezie — prowadzenie w pomarańczowej sukience",
    category: "zajecia",
  },
  {
    id: "zajecia-latino-solo-4",
    src: zajeciaLatino4,
    alt: "Para latino solo na turnieju — tancerka w różowej sukni z frędzlami",
    category: "zajecia",
  },
  {
    id: "zajecia-latino-solo-5",
    src: zajeciaLatino5,
    alt: "Tancerka latino solo w pomarańczowej sukni z piórami",
    category: "zajecia",
  },
  {
    id: "zajecia-latino-solo-6",
    src: zajeciaLatino6,
    alt: "Tancerka latino solo w niebieskiej sukni z frędzlami na parkiecie",
    category: "zajecia",
  },
];

export const sale: GalleryImage[] = [
  {
    id: "sale-mikolow-sala",
    src: salaMikolow,
    alt: "Sala taneczna M&A Dancing Art w Mikołowie — parkiet, lustra i światło",
    category: "sale",
  },
  {
    id: "sale-mikolow-parkiet",
    src: salaMikolowParkiet,
    alt: "Parkiet sali w Mikołowie — lustra, plakaty i światło nad podłogą",
    category: "sale",
  },
  {
    id: "sale-mikolow-elewacja",
    src: salaMikolowElewacja,
    alt: "Wejście do szkoły tańca M&A Dancing Art w Mikołowie przy Centrum Sportu",
    category: "sale",
  },
  {
    id: "sale-lubliniec",
    src: salaLubliniec,
    alt: "Recepcja szkoły tańca M&A Dancing Art w Lublińcu",
    category: "sale",
  },
  {
    id: "sale-img-0694",
    src: salaImg0694,
    alt: "Parkiet hali turniejowej podczas występu pary latino",
    category: "sale",
  },
];

export const pokazy: GalleryImage[] = [
  {
    id: "pokazy-2",
    src: pokaz2,
    alt: "Pokaz pary latino — tancerka w czerwonej sukni na imprezie",
    category: "pokazy",
  },
  {
    id: "pokazy-1",
    src: pokaz1,
    alt: "Pokaz latino — trzech tancerzy na parkiecie podczas imprezy",
    category: "pokazy",
  },
  {
    id: "pokazy-pierwszy-taniec-1",
    src: pokazPierwszyTaniec1,
    alt: "Pierwszy taniec weselny — para w chmurze suchego lodu",
    category: "pokazy",
  },
  {
    id: "pokazy-pierwszy-taniec-2",
    src: pokazPierwszyTaniec2,
    alt: "Pierwszy taniec weselny — pan młody unosi pannę młodą na parkiecie",
    category: "pokazy",
  },
  {
    id: "pokazy-img-5339",
    src: pokazImg5339,
    alt: "Tancerka latino w zielonej sukience z piórami na festiwalu tańca",
    category: "pokazy",
  },
  {
    id: "pokazy-img-1945",
    src: pokazImg1945,
    alt: "Tancerka latino w ujęciu czarno-białym na parkiecie",
    category: "pokazy",
  },
  {
    id: "pokazy-para-standard",
    src: pokazParaStandard,
    alt: "Para w tańcu standardowym — tancerka w brzoskwiniowej sukni",
    category: "pokazy",
  },
];

export const galleryByCategory: Record<GalleryCategoryId, GalleryImage[]> = {
  turnieje,
  zajecia,
  sale,
  pokazy,
};

export const galleryAll: GalleryImage[] = GALLERY_CATEGORIES.flatMap(
  (category) => galleryByCategory[category.id],
);
