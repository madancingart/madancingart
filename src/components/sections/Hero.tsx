import { ChevronDown } from "lucide-react";
import Image from "next/image";
import heroImage from "@/assets/hero/hero.jpg";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

export function Hero() {
  return (
    <section className="relative -mt-16 h-[100svh] min-h-[560px]">
      <Image
        src={heroImage}
        alt="Para latino M&A Dancing Art na parkiecie turniejowym"
        fill
        priority
        fetchPriority="high"
        quality={70}
        placeholder="blur"
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 from-10% via-black/40 to-transparent"
        aria-hidden
      />

      <Container className="relative flex h-full flex-col justify-end pb-24 pt-28">
        <Reveal className="max-w-2xl" onMount>
          <span className="mb-3 block font-script text-4xl text-gold md:text-5xl">
            Taniec to coś więcej niż kroki
          </span>
          <h1 className="font-sans text-4xl font-semibold tracking-tight text-cream text-balance md:text-6xl">
            Szkoła tańca w Mikołowie i Lublińcu
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-cream/85">
            Kurs tańca w małych grupach: pierwszy taniec, latino solo i zajęcia
            dla dzieci, dorosłych oraz seniorów.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
            <Button href="/grafik" size="lg">
              Zapisz się na zajęcia
            </Button>
            <Button href="/oferta" variant="outline" size="lg">
              Zobacz ofertę
            </Button>
          </div>
        </Reveal>
      </Container>

      <a
        href="#zaufanie"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gold/80 transition-colors duration-300 hover:text-gold"
        aria-label="Przewiń w dół"
      >
        <ChevronDown strokeWidth={1.5} className="size-8" aria-hidden />
      </a>
    </section>
  );
}
