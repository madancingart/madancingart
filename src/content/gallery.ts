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
import salaImg0694 from "@/assets/gallery/sale/img-0694.jpg";
import turniejImg0698 from "@/assets/gallery/turnieje/img-0698.jpg";
import turniejImg0699 from "@/assets/gallery/turnieje/img-0699.jpg";
import turniejImg1946 from "@/assets/gallery/turnieje/img-1946.jpg";
import turniejImg1947 from "@/assets/gallery/turnieje/img-1947.jpg";
import turniejImg4567 from "@/assets/gallery/turnieje/img-4567.jpg";
import turniejImg4569 from "@/assets/gallery/turnieje/img-4569.jpg";

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
];

export const zajecia: GalleryImage[] = [];

export const sale: GalleryImage[] = [
  {
    id: "sale-img-0694",
    src: salaImg0694,
    alt: "Parkiet hali turniejowej podczas występu pary latino",
    category: "sale",
  },
];

export const pokazy: GalleryImage[] = [
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
