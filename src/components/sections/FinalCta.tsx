import Image from "next/image";
import ctaImage from "@/assets/gallery/turnieje/ola-mikolaj.jpg";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function FinalCta() {
  return (
    <section className="relative min-h-[60svh] overflow-hidden py-28">
      <Image
        src={ctaImage}
        alt="Aleksandra Janosz i Mikołaj Mazur podczas występu latino"
        fill
        sizes="100vw"
        className="object-cover object-[42%_32%] sm:object-[center_38%] lg:object-[center_42%]"
      />
      <div
        className="absolute inset-0 bg-black/70"
        aria-hidden
      />
      <Container className="relative flex flex-col items-center text-center">
        <span className="mb-3 block font-script text-4xl text-gold md:text-5xl">
          Do zobaczenia na parkiecie
        </span>
        <h2 className="max-w-2xl font-sans text-3xl font-semibold tracking-tight text-cream md:text-5xl">
          Pierwszy krok zrób już dziś
        </h2>
        <Button href="/grafik" size="lg" className="mt-8">
          Sprawdź grafik i zapisz się
        </Button>
      </Container>
    </section>
  );
}
