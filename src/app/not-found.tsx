import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const links = [
  { href: "/", label: "Strona główna" },
  { href: "/grafik", label: "Grafik" },
  { href: "/kontakt", label: "Kontakt" },
] as const;

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex flex-1 flex-col py-20 md:py-28">
        <Container className="flex flex-col items-center text-center">
          <SectionHeading
            script="Zgubiliśmy krok"
            title="Nie ma takiej strony"
            titleAs="h1"
          />
          <nav aria-label="Gdzie dalej" className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-cream transition-colors duration-300 hover:text-gold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </Container>
      </main>
      <Footer />
    </>
  );
}
