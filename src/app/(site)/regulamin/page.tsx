import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";
import { telHref } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Regulamin — M&A Dancing Art",
  description:
    "Zasady zapisów i zajęć w szkole tańca M&A Dancing Art w Mikołowie i Lublińcu.",
};

export default function TermsPage() {
  return (
    <section className="py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading
          script="Zasady"
          title="Regulamin"
          titleAs="h1"
          align="left"
          className="mb-10"
        />
        <div className="flex flex-col gap-5 text-muted">
          <p>
            Zajęcia odbywają się w Mikołowie ({site.locations[0].address}) i w
            Lublińcu ({site.locations[1].address}).
          </p>
          <p>
            Termin wybierasz w{" "}
            <Link href="/grafik" className="text-gold hover:text-gold-light">
              grafiku
            </Link>
            . Zapis potwierdzamy telefonicznie albo mailowo. Ceny są na stronie{" "}
            <Link href="/cennik" className="text-gold hover:text-gold-light">
              cennika
            </Link>
            .
          </p>
          <p>
            Pytania:{" "}
            <a href={telHref(site.phone)} className="text-gold hover:text-gold-light">
              {site.phone}
            </a>{" "}
            albo{" "}
            <a href={`mailto:${site.email}`} className="text-gold hover:text-gold-light">
              {site.email}
            </a>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
