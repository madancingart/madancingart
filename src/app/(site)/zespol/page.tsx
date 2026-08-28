import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { GoldDivider } from "@/components/ui/GoldDivider";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import { teamMembers } from "@/content/team";

export const metadata: Metadata = {
  title: "Zespół — M&A Dancing Art Mikołów i Lubliniec",
  description:
    "Poznaj instruktorów M&A Dancing Art: Aleksandrę Janosz, Mikołaja Mazura i Dagmarę Janosz — klasa S i A, parkiety ogólnopolskie i międzynarodowe.",
};

export default function TeamPage() {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading
          script="Poznaj nas"
          title="Zespół M&A Dancing Art"
          titleAs="h1"
          className="mb-16 md:mb-24"
        />

        {teamMembers.map((member, index) => {
          const photo = member.photos[0];
          const photoFirstOnDesktop = index % 2 === 0;

          return (
            <div key={member.slug}>
              {index > 0 ? (
                <GoldDivider className="my-16 md:my-24" />
              ) : null}
              <Reveal>
                <article
                  className={cn(
                    "grid items-center gap-10 md:grid-cols-2 md:gap-16",
                  )}
                >
                  {photo ? (
                    <div
                      className={cn(
                        "relative aspect-[3/4] overflow-hidden",
                        photoFirstOnDesktop ? "md:order-1" : "md:order-2",
                      )}
                    >
                      <Image
                        src={photo}
                        alt={`${member.name} — zdjęcie turniejowe, ${member.classInfo}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover object-top"
                      />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      photoFirstOnDesktop ? "md:order-2" : "md:order-1",
                    )}
                  >
                    <p className="mb-2 text-sm tracking-wide text-muted">
                      {member.role}
                    </p>
                    <h2 className="font-sans text-3xl font-semibold tracking-tight text-cream md:text-4xl">
                      {member.name}
                    </h2>
                    <p className="mt-3 text-gold">{member.classInfo}</p>
                    <ul className="mt-8 flex flex-col gap-3">
                      {member.achievements.map((item) => (
                        <li
                          key={item}
                          className="grid grid-cols-[1.25rem_1fr] gap-x-2 text-cream/90"
                        >
                          <span className="text-gold" aria-hidden>
                            —
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8 flex flex-col gap-4 text-muted">
                      {member.bio.map((paragraph) => (
                        <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </article>
              </Reveal>
            </div>
          );
        })}
      </Container>
    </section>
  );
}
