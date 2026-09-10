import type { Metadata } from "next";
import { PriceRow } from "@/components/pricing/PriceRow";
import { PricingTabs } from "@/components/pricing/PricingTabs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import {
  isPromoSection,
  pricing,
} from "@/content/pricing";
import type { LocationId } from "@/content/site";

export const metadata: Metadata = {
  title: "Cennik — kursy tańca Mikołów i Lubliniec | M&A Dancing Art",
  description:
    "Cennik kursów tańca M&A Dancing Art w Mikołowie i Lublińcu: zajęcia dla dzieci, latino solo, taniec użytkowy i lekcje indywidualne.",
};

type CennikPageProps = {
  searchParams: Promise<{ lokalizacja?: string }>;
};

function resolveLocation(value: string | undefined): LocationId {
  return value === "lubliniec" ? "lubliniec" : "mikolow";
}

export default async function CennikPage({ searchParams }: CennikPageProps) {
  const params = await searchParams;
  const locationId = resolveLocation(params.lokalizacja);
  const sections = pricing[locationId];

  return (
    <section className="py-20 md:py-28">
      <Container className="max-w-3xl">
        <Reveal onMount>
          <SectionHeading
            script="Transparentnie"
            title="Cennik"
            titleAs="h1"
            className="mb-10"
          />
        </Reveal>

        <PricingTabs active={locationId} />

        <div className="mt-10 flex flex-col gap-6">
          {sections.map((section) => {
            const promo = isPromoSection(section);

            return (
              <Card
                key={section.title}
                className={cn(
                  "hover:translate-y-0",
                  promo
                    ? "relative border-gold/50 hover:border-gold/50"
                    : "hover:border-white/5",
                )}
              >
                {promo ? (
                  <span className="absolute top-4 right-4 border border-gold/60 px-2 py-0.5 text-xs tracking-wide text-gold">
                    Promocja
                  </span>
                ) : null}
                <h2 className="mb-6 pr-24 text-xl font-semibold text-cream">
                  {section.title}
                </h2>
                <ul className="flex flex-col gap-4">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <PriceRow item={item} />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-start gap-5 border-t border-white/5 pt-10 md:flex-row md:items-center md:justify-between">
          <p className="max-w-lg text-muted" suppressHydrationWarning>
            Zapis online opłacasz z góry (Stripe). Kwota jest liczona z tego
            cennika.
          </p>
          <Button href="/grafik" size="lg">
            Zobacz grafik
          </Button>
        </div>
      </Container>
    </section>
  );
}
