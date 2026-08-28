import type { Metadata } from "next";
import { GalleryMasonry } from "@/components/gallery/GalleryMasonry";
import { GalleryTabs } from "@/components/gallery/GalleryTabs";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  GALLERY_FILTERS,
  galleryAll,
  galleryByCategory,
  type GalleryFilterId,
} from "@/content/gallery";

export const metadata: Metadata = {
  title: "Galeria — szkoła tańca Mikołów i Lubliniec | M&A Dancing Art",
  description:
    "Zdjęcia z turniejów, zajęć, sal i pokazów M&A Dancing Art w Mikołowie i Lublińcu.",
};

type GaleriaPageProps = {
  searchParams: Promise<{ kategoria?: string }>;
};

function resolveFilter(value: string | undefined): GalleryFilterId {
  if (GALLERY_FILTERS.some((filter) => filter.id === value)) {
    return value as GalleryFilterId;
  }

  return "wszystkie";
}

export default async function GaleriaPage({ searchParams }: GaleriaPageProps) {
  const params = await searchParams;
  const filter = resolveFilter(params.kategoria);
  const images =
    filter === "wszystkie" ? galleryAll : galleryByCategory[filter];

  return (
    <section className="py-20 md:py-28">
      <Container>
        <Reveal onMount>
          <SectionHeading
            script="Parkiet"
            title="Galeria"
            titleAs="h1"
            sub="Turnieje, zajęcia, sale i pokazy — kadry z życia szkoły."
            className="mb-10"
          />
        </Reveal>

        <GalleryTabs active={filter} />
        <GalleryMasonry images={images} />
      </Container>
    </section>
  );
}
