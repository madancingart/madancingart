import { redirect } from "next/navigation";
import { AdminWeekCalendar } from "@/components/admin/AdminWeekCalendar";
import { getAdminCalendar } from "@/lib/admin/get-calendar";
import { requireAdmin } from "@/lib/admin/require-admin";
import { nowInWarsaw } from "@/lib/datetime";
import type { LocationId } from "@/content/site";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    lokalizacja?: string;
    tydzien?: string;
    nowy?: string;
  }>;
};

function parseWeek(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(26, Math.max(-26, parsed));
}

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const location: LocationId | null =
    params.lokalizacja === "mikolow" || params.lokalizacja === "lubliniec"
      ? params.lokalizacja
      : null;

  const weekOffset = parseWeek(params.tydzien);
  const query = new URLSearchParams();
  query.set("lokalizacja", "mikolow");
  if (weekOffset !== 0) {
    query.set("tydzien", String(weekOffset));
  }
  if (params.nowy === "slot") {
    query.set("nowy", "slot");
  }
  if (!location) {
    redirect(`/admin/kalendarz?${query.toString()}`);
  }

  const now = nowInWarsaw();
  const nowIso = now.toISOString();
  const data = await getAdminCalendar(supabase, location, nowIso, weekOffset);

  return (
    <div>
      <h1 className="sr-only">Kalendarz — {location}</h1>
      <AdminWeekCalendar
        locationId={location}
        nowIso={nowIso}
        weekOffset={weekOffset}
        data={data}
        openAddInitially={params.nowy === "slot"}
      />
    </div>
  );
}
