import Link from "next/link";
import { formatBillingZloty } from "@/lib/billing/status";
import type { PublicCourseCard } from "@/lib/courses/catalog";
import type { LocationId } from "@/content/site";

export function CourseCards({
  courses,
  locationId,
}: {
  courses: PublicCourseCard[];
  locationId: LocationId;
}) {
  const visible = courses.filter(
    (course) => course.locationId === locationId || course.locationId === null,
  );
  if (visible.length === 0) {
    return null;
  }

  return (
    <section className="mb-10" aria-labelledby="kursy-heading">
      <h2 id="kursy-heading" className="text-lg text-cream">
        Kursy
      </h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {visible.map((course) => (
          <li key={course.slug} className="border border-gold/40 bg-black-soft p-4">
            <h3 className="text-base text-cream">{course.title}</h3>
            <p className="mt-2 text-sm text-muted">{course.when}</p>
            <p className="mt-1 text-sm text-cream">{course.city}</p>
            <p className="mt-2 text-sm text-gold">{formatBillingZloty(course.priceCents)}</p>
            <p className="mt-1 text-sm text-muted">{course.freeLabel}</p>
            <Link
              href={`/kursy/${course.slug}`}
              className="mt-4 inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light"
            >
              Szczegóły i zapis
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
