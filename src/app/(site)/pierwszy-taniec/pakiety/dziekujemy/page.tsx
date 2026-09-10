import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Zgłoszenie pakietu przyjęte — M&A Dancing Art",
};

export default function PackageThanksPage() {
  return (
    <section className="py-24">
      <Container className="max-w-xl text-center">
        <p className="font-script text-4xl text-gold">Dziękujemy</p>
        <h1 className="mt-3 text-3xl font-semibold text-cream">
          Zgłoszenie przyjęte
        </h1>
        <p className="mt-4 text-muted">
          Pakiet czeka na płatność na miejscu. Po wpłacie aktywujemy go i
          skontaktujemy się, by umówić pierwszą lekcję. Telefon szkoły:{" "}
          {site.phone}.
        </p>
        <Button href="/" className="mt-8">
          Strona główna
        </Button>
      </Container>
    </section>
  );
}
