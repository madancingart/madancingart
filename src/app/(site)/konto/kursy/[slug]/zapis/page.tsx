import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseEnrollForm } from "@/components/account/CourseEnrollForm";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";
import { getPublishedCourse } from "@/lib/courses/catalog";
import { customerDisplayName } from "@/lib/admin/customer-label";
import { createClient } from "@/lib/supabase/server";
import type { MyParticipantRow } from "@/lib/types";

export const metadata: Metadata = {
  title: `Zapis na kurs — ${site.name}`,
  robots: { index: false, follow: false },
};

export default async function CourseSignupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const next = `/konto/kursy/${slug}/zapis`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/konto/logowanie?next=${encodeURIComponent(next)}`);
  }
  const { data: profile } = await supabase
    .from("account_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) {
    redirect(`/konto/uzupelnij?next=${encodeURIComponent(next)}`);
  }

  const course = await getPublishedCourse(slug);
  if (!course || !course.signupOpen) {
    return (
      <section className="py-16 md:py-24">
        <Container className="mx-auto max-w-xl">
          <p className="text-cream">Ten kurs nie przyjmuje zapisów.</p>
          <Link href="/grafik" className="mt-4 inline-flex text-gold">
            Wróć do grafiku
          </Link>
        </Container>
      </section>
    );
  }

  const { data: participantRows } = await supabase.rpc("my_participants");
  const people = ((participantRows ?? []) as MyParticipantRow[]).map((person) => ({
    id: person.id,
    label: customerDisplayName({
      kind: person.kind,
      firstName: person.first_name,
      lastName: person.last_name,
      partnerFirstName: person.partner_first_name,
      partnerLastName: person.partner_last_name,
    }),
  }));

  return (
    <section className="py-16 md:py-24">
      <Container className="mx-auto max-w-xl">
        <SectionHeading script="Zapis" title={course.title} titleAs="h1" />
        <p className="mt-6 text-sm text-muted">{course.city}</p>
        <div className="mt-8">
          <CourseEnrollForm slug={course.slug} people={people} full={course.full} />
        </div>
        {people.length === 0 ? (
          <Link href="/konto/uczestnicy" className="mt-4 inline-flex text-sm text-gold">
            Dodaj uczestnika
          </Link>
        ) : null}
      </Container>
    </section>
  );
}
