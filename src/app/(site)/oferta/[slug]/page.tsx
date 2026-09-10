import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import {
  getOfferBySlug,
  offerCtaHref,
  offerItems,
} from "@/content/offer";
import { site } from "@/content/site";

type OfferPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return offerItems.map((item) => ({ slug: item.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: OfferPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getOfferBySlug(slug);

  if (!item) {
    return {};
  }

  return {
    title: `${item.name} — M&A Dancing Art Mikołów i Lubliniec`,
    description: item.shortDesc,
  };
}

export default async function OfferDetailPage({ params }: OfferPageProps) {
  const { slug } = await params;
  const item = getOfferBySlug(slug);

  if (!item) {
    notFound();
  }

  const locationLabels = item.locations.map((id) => {
    const location = site.locations.find((entry) => entry.id === id);
    return location?.city ?? id;
  });

  return (
    <>
      <section className="relative -mt-16 min-h-[50svh]">
        <Image
          src={item.image}
          alt={`${item.name} — M&A Dancing Art`}
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
            {item.scriptPhrase}
          </span>
          <h1 className="max-w-3xl font-sans text-4xl font-semibold tracking-tight text-cream md:text-6xl">
            {item.name}
          </h1>
        </Container>
      </section>

      <section className="py-16 md:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr] lg:gap-16">
            <Reveal>
              <div className="flex flex-col gap-5 text-muted">
                {item.longDesc.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
                <p className="text-cream">Dla kogo: {item.audience}</p>
              </div>
            </Reveal>
            <Reveal>
              <Card>
                <h2 className="mb-4 text-xl font-semibold text-cream">
                  W skrócie
                </h2>
                <ul className="flex flex-col gap-2 text-cream/90">
                  {item.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3">
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-gold"
                        aria-hidden
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm text-muted">Lokalizacje</p>
                <p className="mt-1 text-cream">{locationLabels.join(" · ")}</p>
              </Card>
            </Reveal>
          </div>
        </Container>
      </section>

      {item.gallery && item.gallery.length > 0 ? (
        <section className="pb-16">
          <Container>
            <ul className="flex gap-4 overflow-x-auto pb-2">
              {item.gallery.map((src) => (
                <li
                  key={src}
                  className="relative h-48 w-72 shrink-0 overflow-hidden"
                >
                  <Image
                    src={src}
                    alt={`${item.name} — zdjęcie z galerii`}
                    fill
                    sizes="288px"
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      <section className="border-t border-white/5 py-16 md:py-20">
        <Container className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <Reveal>
            <h2 className="text-2xl font-semibold text-cream md:text-3xl">
              {item.ctaLabel}
            </h2>
          </Reveal>
          <Button href={offerCtaHref(item)} size="lg">
            {item.ctaLabel}
          </Button>
        </Container>
      </section>
    </>
  );
}
