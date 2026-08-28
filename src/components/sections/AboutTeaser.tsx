import Image from "next/image";
import Link from "next/link";
import aboutImage from "@/assets/gallery/about.jpg";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { aboutParagraphs } from "@/content/about";

export function AboutTeaser() {
  return (
    <section className="overflow-x-hidden py-20 md:py-28">
      <Container>
        <div className="grid items-center gap-12 md:grid-cols-5 md:gap-10">
          <div className="md:col-span-2">
            <SectionHeading
              script="O nas"
              title="Szkoła tworzona z pasją"
              align="left"
              className="mb-6"
            />
            <div className="flex flex-col gap-4 text-muted">
              {aboutParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
            <Link
              href="/o-nas"
              className="mt-8 inline-block text-gold transition-colors duration-300 hover:text-gold-light"
            >
              Poznaj naszą historię →
            </Link>
          </div>

          <div className="md:col-span-3">
            <div className="relative md:translate-x-8">
              <div
                className="absolute inset-0 translate-x-3 translate-y-3 border border-gold"
                aria-hidden
              />
              <div className="relative aspect-[4/5] overflow-hidden md:aspect-[5/4]">
                <Image
                  src={aboutImage}
                  alt="Aleksandra i Mikołaj podczas występu latino na parkiecie"
                  fill
                  sizes="(max-width: 768px) 100vw, 55vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
