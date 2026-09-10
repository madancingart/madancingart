import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Płatność niedokończona | M&A Dancing Art",
  robots: { index: false, follow: false },
};

export default function BookingCheckoutCancelledPage() {
  return (
    <section className="py-20 md:py-28">
      <Container className="max-w-lg">
        <SectionHeading
          script="Bez pośpiechu"
          title="Płatność nie została dokończona"
          titleAs="h1"
          align="left"
          sub={`Termin trzymamy około 30 minut. Możesz wrócić do grafiku i zapisać się ponownie. W razie pytań: ${site.phone}.`}
        />
        <Button href="/grafik" className="mt-10 min-h-11">
          Wróć do grafiku
        </Button>
      </Container>
    </section>
  );
}
