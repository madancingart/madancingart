import type { Metadata } from "next";
import { OfferGrid } from "@/components/offer/OfferGrid";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Oferta — M&A Dancing Art Mikołów i Lubliniec",
  description:
    "Kurs tańca w Mikołowie i Lublińcu: pierwszy taniec weselny, latino solo, zajęcia dla dzieci, taniec użytkowy, Pro-Am i pokazy.",
};

export default function OfferPage() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            script="Nasza oferta"
            title="Znajdź zajęcia dla siebie"
            sub="Dziewięć ścieżek — od pierwszych kroków dziecka po parkiet weselny i scenę."
            titleAs="h1"
            className="mb-12"
          />
        </Reveal>
        <Reveal>
          <OfferGrid />
        </Reveal>
      </Container>
    </section>
  );
}
