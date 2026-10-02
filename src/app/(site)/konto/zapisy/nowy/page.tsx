import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EnrollmentForm } from "@/components/account/EnrollmentForm";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";
import { firstParam } from "@/lib/account/params";
import { newClassSignupPath } from "@/lib/account/redirect";
import { loadSignupGroups } from "@/lib/account/signup-catalog";
import { previewEnrollment } from "@/lib/billing/preview";
import { createClient } from "@/lib/supabase/server";
import type { MyParticipantRow } from "@/lib/types";

export const metadata: Metadata = {
  title: `Zapis na zajęcia — ${site.name}`,
  robots: { index: false, follow: false },
};

export default async function NewEnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ grupa?: string | string[] }>;
}) {
  const params = await searchParams;
  const classId = firstParam(params.grupa) ?? "";
  const next = classId ? newClassSignupPath(classId) : "/konto/zapisy/nowy";
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

  const [{ data: participantRows }, groups] = await Promise.all([
    supabase.rpc("my_participants"),
    loadSignupGroups(),
  ]);
  const people = ((participantRows ?? []) as MyParticipantRow[]).map((person) => ({
    id: person.id,
    kind: person.kind,
    label: participantLabel(person),
  }));
  const initialCustomer = people[0]?.id ?? "";
  const initialPreview =
    initialCustomer && groups.some((group) => group.id === classId)
      ? await previewEnrollment({ classId, customerId: initialCustomer })
      : null;

  return (
    <section className="py-16 md:py-24">
      <Container className="mx-auto max-w-xl">
        <SectionHeading script="Dołącz" title="Stałe zajęcia" titleAs="h1" />
        <div className="mt-10">
          <EnrollmentForm
            people={people}
            groups={groups}
            initialClassId={classId}
            initialPreview={initialPreview}
          />
        </div>
      </Container>
    </section>
  );
}

function participantLabel(person: MyParticipantRow): string {
  const primary = `${person.first_name} ${person.last_name}`;
  if (person.kind !== "pair") {
    return primary;
  }
  const partner = [person.partner_first_name, person.partner_last_name].filter(Boolean).join(" ");
  return partner ? `${primary} i ${partner}` : primary;
}
