import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CourseSessionList } from "@/components/courses/CourseSessionList";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { teamMembers } from "@/content/team";
import { site } from "@/content/site";
import { formatBillingZloty } from "@/lib/billing/status";
import { getPublishedCourse, publishedCourseSlugs } from "@/lib/courses/catalog";

export const revalidate = 300;

const TRAINER_SLUG: Record<string, string> = {
  ola: "aleksandra-janosz",
  mikolaj: "mikolaj-mazur",
  dagmara: "dagmara-janosz",
};

export async function generateStaticParams() {
  const slugs = await publishedCourseSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) {
    notFound();
  }
  return {
    title: `${course.title} — ${site.name}`,
    description: course.description ?? `${course.title} — ${course.city}. ${course.freeLabel}.`,
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) {
    notFound();
  }
  const trainerSlug = course.trainerId ? TRAINER_SLUG[course.trainerId] : undefined;
  const trainer = teamMembers.find((member) => member.slug === trainerSlug);
  const photo = trainer?.photos[0];
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const place = {
    "@type": "Place",
    name: `${site.name}, ${course.city}`,
    address: course.address,
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    name: course.title,
    description: course.description ?? course.title,
    url: `${siteUrl}/kursy/${course.slug}`,
    organizer: { "@type": "Organization", name: site.name },
    location: place,
    subEvent: course.sessions.map((session) => ({
      "@type": "Event",
      name: session.title,
      startDate: session.startsAt,
      endDate: session.endsAt,
      eventStatus: session.cancelled
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
      location: place,
    })),
  };

  return (
    <section className="py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Container className="max-w-3xl">
        <SectionHeading script="Kurs" title={course.title} titleAs="h1" />
        {course.description ? (
          <p className="mt-8 whitespace-pre-line text-cream">{course.description}</p>
        ) : null}
        <p className="mt-6 text-sm text-muted">
          {course.city}
          {course.address ? ` · ${course.address}` : ""} · {course.freeLabel}
        </p>
        <p className="mt-2 text-gold">{formatBillingZloty(course.priceCents)} za cały kurs</p>

        {trainer && photo ? (
          <div className="mt-8 flex items-center gap-4">
            <Image
              src={photo}
              alt={trainer.name}
              sizes="96px"
              className={`h-24 w-20 object-cover ${trainer.photoClass ?? ""}`}
            />
            <div>
              <p className="text-sm text-muted">Prowadzący</p>
              <p className="text-cream">{trainer.name}</p>
            </div>
          </div>
        ) : null}

        <h2 className="mt-12 text-lg text-cream">Terminy</h2>
        <div className="mt-4">
          {course.locationId ? (
            <CourseSessionList
              title={course.title}
              locationId={course.locationId}
              locationLabel={course.city}
              sessions={course.sessions.map((session) => ({
                id: session.id,
                label:
                  session.sessionNo && session.total
                    ? `${session.sessionNo}/${session.total}`
                    : "Spotkanie",
                when: session.when,
                startsAt: session.startsAt,
                endsAt: session.endsAt,
                cancelled: session.cancelled,
                canBook: session.canBook,
                priceCents: session.priceCents,
              }))}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {course.sessions.map((session) => (
                <li key={session.id} className="border border-white/10 bg-black-soft p-4 text-cream">
                  {session.when}
                  {session.cancelled ? <span className="text-muted"> · Odwołane</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-10">
          {course.signupOpen ? (
            <Button href={`/konto/kursy/${course.slug}/zapis`}>Zapisz się na cały kurs</Button>
          ) : (
            <p className="text-sm text-muted">Zapisy na cały kurs są zamknięte.</p>
          )}
          <p className="mt-3 text-sm text-muted">
            Zapis na cały kurs wymaga konta. Na pojedyncze spotkanie można zapisać się bez konta, gdy jest taka opcja.
          </p>
        </div>
      </Container>
    </section>
  );
}
