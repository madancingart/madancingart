import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import salaHero from "@/assets/gallery/mikolow.jpg";
import lubliniecImage from "@/assets/gallery/lubliniec.jpg";
import mikolowImage from "@/assets/gallery/mikolow.jpg";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  aboutParagraphs,
  aboutQuote,
  aboutQuoteScript,
  whyUs,
} from "@/content/about";
import { locationHighlights } from "@/content/home";
import { type LocationId, site } from "@/content/site";

const locationPhotos: Record<LocationId, StaticImageData> = {
  mikolow: mikolowImage,
  lubliniec: lubliniecImage,
};

export const metadata: Metadata = {
  title: "O nas — M&A Dancing Art Mikołów i Lubliniec",
  description:
    "Szkoła tańca M&A Dancing Art w Mikołowie i Lublińcu. Małe grupy, zajęcia indywidualne i komfortowa atmosfera dla dzieci, dorosłych i seniorów.",
};

export default function AboutPage() {
  return (
    <>
      <section className="relative -mt-16 min-h-[50svh]">
        <Image
          src={salaHero}
          alt="Parkiet M&A Dancing Art — zajęcia w Mikołowie"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20"
          aria-hidden
        />
        <Container className="relative flex min-h-[50svh] flex-col justify-end pb-12 pt-28">
          <span className="mb-3 block font-script text-4xl text-gold md:text-5xl">
            Nasza historia
          </span>
          <h1 className="max-w-3xl font-sans text-4xl font-semibold tracking-tight text-cream md:text-6xl">
            Szkoła tworzona z pasją
          </h1>
        </Container>
      </section>

      <section className="py-16 md:py-24">
        <Container className="max-w-3xl">
          <Reveal>
            <div className="flex flex-col gap-5 text-muted">
              {aboutParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="pb-16 md:pb-24">
        <Container>
          <Reveal>
            <SectionHeading
              script="Dlaczego my"
              title="To, na czym budujemy zajęcia"
              className="mb-12"
            />
          </Reveal>
          <ul className="grid gap-6 sm:grid-cols-2">
            {whyUs.map((item) => (
              <li key={item.title}>
                <Reveal>
                  <Card className="h-full">
                    <h3 className="text-xl font-semibold text-cream">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-muted">{item.text}</p>
                  </Card>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="border-y border-white/5 py-20 md:py-28">
        <Container className="max-w-4xl text-center">
          <Reveal>
            <figure>
              <span className="block font-script text-4xl text-gold md:text-6xl">
                {aboutQuoteScript}
              </span>
              <blockquote className="mt-6 font-sans text-2xl font-semibold tracking-tight text-gold text-balance md:text-4xl">
                {aboutQuote}
              </blockquote>
            </figure>
          </Reveal>
        </Container>
      </section>

      <section className="py-16 md:py-24">
        <Container>
          <Reveal>
            <SectionHeading
              script="Gdzie tańczymy"
              title="Mikołów i Lubliniec"
              className="mb-12"
            />
          </Reveal>
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
                  <h2 className="text-2xl font-semibold text-cream">
                    {location.city}
                  </h2>
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
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-white/5 py-16 md:py-20">
        <Container className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <Reveal>
            <h2 className="text-2xl font-semibold text-cream md:text-3xl">
              Sprawdź, kiedy tańczymy
            </h2>
          </Reveal>
          <Button href="/grafik" size="lg">
            Zobacz grafik
          </Button>
        </Container>
      </section>
    </>
  );
}
