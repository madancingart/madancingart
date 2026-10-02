import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import lubliniecImage from "@/assets/gallery/lubliniec.jpg";
import mikolowImage from "@/assets/gallery/sale/mikolow-parkiet.jpg";
import { ContactForm } from "@/components/contact/ContactForm";
import { MapFacade } from "@/components/contact/MapFacade";
import { FacebookIcon, InstagramIcon } from "@/components/ui/SocialIcons";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { classWeekdays, formatWeekdays } from "@/content/class-days";
import { site, type LocationId } from "@/content/site";
import {
  appleMapsUrl,
  googleMapsEmbedUrl,
  googleMapsUrl,
  telHref,
} from "@/lib/contact";
import { getSchedule } from "@/lib/schedule/get-schedule";
import { contactPageJsonLd } from "@/lib/schema";
import { hasSupabaseEnv } from "@/lib/supabase/env";

const lead =
  "Zadzwoń lub napisz — pomożemy dobrać grupę, termin albo choreografię.";

const locationPhotos: Record<LocationId, StaticImageData> = {
  mikolow: mikolowImage,
  lubliniec: lubliniecImage,
};

export const metadata: Metadata = {
  title: "Kontakt — szkoła tańca Mikołów i Lubliniec | M&A Dancing Art",
  description: lead,
};

async function daysFor(locationId: LocationId): Promise<string> {
  const fallback = classWeekdays[locationId];
  if (!hasSupabaseEnv()) {
    return formatWeekdays(fallback);
  }

  const schedule = await getSchedule();
  const live = [
    ...new Set(
      (schedule?.classes ?? [])
        .filter((item) => item.locationId === locationId)
        .map((item) => item.weekday),
    ),
  ].sort((left, right) => left - right);

  return formatWeekdays(live.length > 0 ? live : fallback);
}

export default async function ContactPage() {
  const days = {
    mikolow: await daysFor("mikolow"),
    lubliniec: await daysFor("lubliniec"),
  };
  const jsonLd = JSON.stringify(contactPageJsonLd());

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <section className="py-20 md:py-28">
        <Container>
          <SectionHeading
            script="Porozmawiajmy"
            title="Kontakt"
            titleAs="h1"
            sub={lead}
          />
        </Container>
      </section>

      <section className="pb-16 md:pb-24">
        <Container className="flex flex-col items-center gap-6 text-center">
          <a
            href={telHref(site.phone)}
            className="font-sans text-4xl text-cream transition-colors duration-300 hover:text-gold md:text-5xl"
          >
            {site.phone}
          </a>
          <a
            href={`mailto:${site.email}`}
            className="text-xl text-cream transition-colors duration-300 hover:text-gold"
          >
            {site.email}
          </a>
          <div className="flex gap-4">
            <a
              href={site.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-cream transition-colors duration-300 hover:text-gold"
            >
              <InstagramIcon />
            </a>
            <a
              href={site.social.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-cream transition-colors duration-300 hover:text-gold"
            >
              <FacebookIcon />
            </a>
          </div>
        </Container>
      </section>

      <section className="pb-20 md:pb-28">
        <Container>
          <ul className="grid gap-8 lg:grid-cols-2">
            {site.locations.map((location) => (
              <li
                key={location.id}
                className="border border-white/5 bg-black-soft"
              >
                <div className="relative aspect-[16/10]">
                  <Image
                    src={locationPhotos[location.id]}
                    alt={`Sala taneczna w ${location.city === "Mikołów" ? "Mikołowie" : "Lublińcu"}, ${location.address}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col gap-4 p-6 md:p-8">
                  <div>
                    <h2 className="text-2xl font-semibold text-cream">
                      {location.city}
                    </h2>
                    <p className="mt-1 text-muted">{location.address}</p>
                    <p className="mt-4 text-cream">
                      Dni zajęć: {days[location.id]}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <a
                      href={googleMapsUrl(location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center border border-gold px-3 py-1.5 text-sm text-gold transition-colors duration-300 hover:bg-gold/10"
                    >
                      Nawiguj — Google Maps
                    </a>
                    <a
                      href={appleMapsUrl(location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center border border-gold px-3 py-1.5 text-sm text-gold transition-colors duration-300 hover:bg-gold/10"
                    >
                      Apple Maps
                    </a>
                  </div>
                  <MapFacade
                    src={googleMapsEmbedUrl(location)}
                    title={`Mapa: ${location.city}, ${location.address}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="pb-20 md:pb-28">
        <Container className="max-w-xl">
          <h2 className="mb-8 text-2xl font-semibold text-cream">
            Napisz do nas
          </h2>
          <ContactForm />
        </Container>
      </section>
    </>
  );
}
