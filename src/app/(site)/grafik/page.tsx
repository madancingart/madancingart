import type { Metadata } from "next";
import { ScheduleLegend } from "@/components/schedule/ScheduleLegend";
import { ScheduleLocationTabs } from "@/components/schedule/ScheduleLocationTabs";
import { WeekCalendar } from "@/components/schedule/WeekCalendar";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { nowInWarsaw } from "@/lib/datetime";
import { getSchedule } from "@/lib/schedule/get-schedule";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { LocationId } from "@/content/site";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Grafik zajęć i zapisy — Mikołów i Lubliniec | M&A Dancing Art",
  description:
    "Grafik zajęć M&A Dancing Art w Mikołowie i Lublińcu: zapisy na grupy, lekcje indywidualne i wydarzenia.",
};

type GrafikPageProps = {
  searchParams: Promise<{ lokalizacja?: string }>;
};

function resolveLocation(value: string | undefined): LocationId {
  return value === "lubliniec" ? "lubliniec" : "mikolow";
}

export default async function GrafikPage({ searchParams }: GrafikPageProps) {
  const params = await searchParams;
  const locationId = resolveLocation(params.lokalizacja);
  const schedule = hasSupabaseEnv() ? await getSchedule() : null;
  const nowIso = nowInWarsaw().toISOString();

  const classes =
    schedule?.classes.filter((item) => item.locationId === locationId) ?? [];
  const slots =
    schedule?.slots.filter((item) => item.locationId === locationId) ?? [];
  const events =
    schedule?.events.filter(
      (item) => item.locationId === locationId || item.locationId === null,
    ) ?? [];

  return (
    <section className="py-20 md:py-28">
      <Container>
        <Reveal onMount>
          <SectionHeading
            script="Dołącz do nas"
            title="Grafik i zapisy"
            titleAs="h1"
            className="mb-10"
            sub="Wybierz salę, znajdź termin i zostaw kontakt. Potwierdzimy zapis telefonicznie lub mailowo."
          />
        </Reveal>

        <ol className="mx-auto mb-12 grid max-w-3xl gap-6 text-center md:grid-cols-3">
          <li>
            <p className="text-gold">1</p>
            <p className="mt-2 text-cream">Wybierz termin</p>
            <p className="mt-1 text-sm text-muted">
              Grupa, lekcja indywidualna albo wydarzenie.
            </p>
          </li>
          <li>
            <p className="text-gold">2</p>
            <p className="mt-2 text-cream">Zostaw kontakt</p>
            <p className="mt-1 text-sm text-muted">
              Imię, telefon i e-mail — nic więcej na start.
            </p>
          </li>
          <li>
            <p className="text-gold">3</p>
            <p className="mt-2 text-cream">Potwierdzimy</p>
            <p className="mt-1 text-sm text-muted">
              Oddzwonimy albo napiszemy, żeby domknąć szczegóły.
            </p>
          </li>
        </ol>

        <ScheduleLocationTabs active={locationId} />

        <div className="mt-8">
          {schedule ? (
            <WeekCalendar
              key={locationId}
              locationId={locationId}
              nowIso={nowIso}
              classes={classes}
              slots={slots}
              events={events}
            />
          ) : (
            <p className="text-muted">
              Nie udało się wczytać grafiku. Spróbuj ponownie za chwilę.
            </p>
          )}
        </div>

        <ScheduleLegend />
      </Container>
    </section>
  );
}
