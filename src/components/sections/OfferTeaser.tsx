import { OfferGrid } from "@/components/offer/OfferGrid";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function OfferTeaser() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading
          script="Nasza oferta"
          title="Znajdź zajęcia dla siebie"
          className="mb-12"
        />
        <OfferGrid />
      </Container>
    </section>
  );
}
