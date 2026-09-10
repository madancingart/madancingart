import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Płatność przyjęta | M&A Dancing Art",
  robots: { index: false, follow: false },
};

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function BookingPaidPage({
  searchParams,
}: SuccessPageProps) {
  await searchParams;

  return (
    <section className="py-20 md:py-28">
      <Container className="max-w-lg">
        <SectionHeading
          script="Dziękujemy"
          title="Płatność przyjęta"
          titleAs="h1"
          align="left"
          sub={`Potwierdzenie zapisu wyślemy na e-mail. W razie pytań: ${site.phone}.`}
        />
        <Button href="/grafik" className="mt-10 min-h-11">
          Wróć do grafiku
        </Button>
      </Container>
    </section>
  );
}
