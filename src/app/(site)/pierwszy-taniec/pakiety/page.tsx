import type { Metadata } from "next";
import { PackagePurchaseForm } from "@/components/packages/PackagePurchaseForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import { formatPlnFromCents } from "@/lib/money";
import {
  getWeddingPackage,
  WEDDING_PACKAGES,
  type WeddingPackageKind,
} from "@/content/packages";

export const metadata: Metadata = {
  title: "Pakiety pierwszego tańca — M&A Dancing Art",
  description:
    "Wybierz pakiet lekcji indywidualnych na pierwszy taniec weselny. Pojedyncza lekcja, 6 lub 10 godzin — Mikołów i Lubliniec.",
};

type PageProps = {
  searchParams: Promise<{ pakiet?: string }>;
};

export default async function WeddingPackagesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const fromQuery = getWeddingPackage(params.pakiet ?? "");
  const initialKind: WeddingPackageKind =
    fromQuery?.kind ?? "wedding_6";

  return (
    <section className="py-20 md:py-28">
      <Container className="max-w-5xl">
        <Reveal onMount>
          <SectionHeading
            script="Wasza chwila"
            title="Pakiety pierwszego tańca"
            sub="Wybierz liczbę lekcji. Choreografię szyjemy pod Waszą muzykę i datę wesela — terminy umawiamy po aktywacji pakietu."
            titleAs="h1"
            className="mb-12"
          />
        </Reveal>

        <ul className="grid gap-6 md:grid-cols-3 md:items-stretch">
          {WEDDING_PACKAGES.map((item) => (
            <li key={item.kind} className={item.featured ? "md:-mt-4" : undefined}>
              <Card
                className={cn(
                  "flex h-full flex-col hover:translate-y-0",
                  item.featured
                    ? "border-gold/70 hover:border-gold/70"
                    : "hover:border-white/5",
                )}
              >
                {item.featured ? (
                  <p className="mb-3 text-xs tracking-wide text-gold">
                    Najczęściej wybierany
                  </p>
                ) : null}
                <h2 className="text-xl font-semibold text-cream">{item.label}</h2>
                <p className="mt-2 text-3xl text-gold">
                  {formatPlnFromCents(item.priceCents)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {item.totalLessons === 1
                    ? "1 lekcja"
                    : `${item.totalLessons} lekcji`}
                </p>
                <p className="mt-4 flex-1 text-sm text-muted">{item.summary}</p>
                <Button
                  href={`?pakiet=${item.kind}#zakup`}
                  className="mt-6 w-full"
                  variant={item.featured ? "primary" : "outline"}
                >
                  Wybieram
                </Button>
              </Card>
            </li>
          ))}
        </ul>

        <div id="zakup" className="mt-16 scroll-mt-24 border-t border-white/10 pt-12">
          <h2 className="text-2xl font-semibold text-cream">Zakup pakietu</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Podajcie dane pary, datę wesela i propozycje utworów. Po opłaceniu
            skontaktujemy się, żeby umówić pierwszą lekcję.
          </p>
          <PackagePurchaseForm
            key={initialKind}
            packages={WEDDING_PACKAGES}
            initialKind={initialKind}
          />
        </div>
      </Container>
    </section>
  );
}
