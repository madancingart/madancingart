import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Płatność przyjęta — pakiet pierwszego tańca | M&A Dancing Art",
};

export default function PackagePaidPage() {
  return (
    <section className="py-24">
      <Container className="max-w-xl text-center">
        <p className="font-script text-4xl text-gold">Gotowe</p>
        <h1 className="mt-3 text-3xl font-semibold text-cream">
          Pakiet opłacony
        </h1>
        <p className="mt-4 text-muted">
          Skontaktujemy się, by umówić pierwszą lekcję. Potwierdzenie wyślemy
          mailem. W razie pytań: {site.phone}.
        </p>
        <Button href="/" className="mt-8">
          Strona główna
        </Button>
      </Container>
    </section>
  );
}
