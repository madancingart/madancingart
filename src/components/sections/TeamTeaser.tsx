import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { teamMembers } from "@/content/team";
import { cn } from "@/lib/cn";

export function TeamTeaser() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading
          script="Instruktorzy"
          title="Poznaj nasze twarze"
          className="mb-12"
        />
        <ul className="grid gap-8 sm:grid-cols-3">
          {teamMembers.map((person) => {
            const photo = person.photos[0];

            return (
              <li key={person.slug} className="text-center">
                {photo ? (
                  <div className="relative mx-auto aspect-[3/4] max-w-sm overflow-hidden">
                    <Image
                      src={photo}
                      alt={`${person.name} — ${person.classInfo}`}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className={cn(
                        "object-cover",
                        person.photoClass ?? "object-top",
                      )}
                    />
                  </div>
                ) : null}
                <h3 className="mt-5 text-xl font-medium text-cream">
                  {person.name}
                </h3>
                <p className="mt-1 text-sm text-muted">{person.classInfo}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-10 text-center">
          <Link
            href="/zespol"
            className="text-gold transition-colors duration-300 hover:text-gold-light"
          >
            Cały zespół →
          </Link>
        </p>
      </Container>
    </section>
  );
}
