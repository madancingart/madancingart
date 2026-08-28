import type { Metadata } from "next";
import { AboutTeaser } from "@/components/sections/AboutTeaser";
import { FinalCta } from "@/components/sections/FinalCta";
import { Hero } from "@/components/sections/Hero";
import { LocationsSection } from "@/components/sections/LocationsSection";
import { OfferTeaser } from "@/components/sections/OfferTeaser";
import { TeamTeaser } from "@/components/sections/TeamTeaser";
import { TrustBar } from "@/components/sections/TrustBar";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "M&A Dancing Art — Szkoła tańca Mikołów i Lubliniec",
  description:
    "Kurs tańca w Mikołowie i Lublińcu. Pierwszy taniec weselny, latino solo, zajęcia dla dzieci, dorosłych i seniorów — w małych grupach, z indywidualnym podejściem.",
};

export default function Home() {
  return (
    <>
      <Hero />
      <Reveal>
        <TrustBar />
      </Reveal>
      <Reveal>
        <AboutTeaser />
      </Reveal>
      <Reveal>
        <OfferTeaser />
      </Reveal>
      <Reveal>
        <LocationsSection />
      </Reveal>
      <Reveal>
        <TeamTeaser />
      </Reveal>
      <Reveal>
        <FinalCta />
      </Reveal>
    </>
  );
}
