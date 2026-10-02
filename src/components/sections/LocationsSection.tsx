import type { StaticImageData } from "next/image";
import Image from "next/image";
import lubliniecImage from "@/assets/gallery/lubliniec.jpg";
import mikolowImage from "@/assets/gallery/sale/mikolow-parkiet.jpg";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { locationHighlights } from "@/content/home";
import { type LocationId, site } from "@/content/site";

const locationPhotos: Record<LocationId, StaticImageData> = {
  mikolow: mikolowImage,
  lubliniec: lubliniecImage,
};

export function LocationsSection() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading
          script="Gdzie tańczymy"
          title="Mikołów i Lubliniec"
          className="mb-12"
        />
        <div className="grid gap-6 md:grid-cols-2">
          {site.locations.map((location) => (
            <Card key={location.id} className="overflow-hidden p-0">
              <div className="relative aspect-[16/10]">
                <Image
                  src={locationPhotos[location.id]}
                  alt={`Sala taneczna M&A Dancing Art — ${location.city}, ${location.address}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6 md:p-8">
                <h3 className="text-2xl font-semibold text-cream">
                  {location.city}
                </h3>
                <p className="mt-1 text-muted">{location.address}</p>
                <ul className="mt-5 flex flex-col gap-2 text-cream/90">
                  {locationHighlights.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-gold"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  href={`/grafik?lokalizacja=${location.id}`}
                  variant="outline"
                  className="mt-8"
                >
                  Grafik zajęć
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
