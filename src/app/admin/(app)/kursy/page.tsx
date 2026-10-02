import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { site } from "@/content/site";
import { formatDateTimeWarsaw } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("event_series")
    .select("id, title, capacity, published, signup_open, location_id")
    .order("created_at", { ascending: false });
  const series = (data ?? []) as {
    id: string;
    title: string;
    capacity: number | null;
    published: boolean;
    signup_open: boolean;
    location_id: string | null;
  }[];
  const ids = series.map((item) => item.id);
  const eventsBySeries = new Map<string, { starts: string; count: number }>();
  const peopleBySeries = new Map<string, { taken: number; paid: number }>();
  if (ids.length > 0) {
    const [{ data: events }, { data: bookings }] = await Promise.all([
      supabase.from("events").select("series_id, starts_at").in("series_id", ids).order("starts_at"),
      supabase
        .from("bookings")
        .select("id, series_id, status")
        .in("series_id", ids)
        .eq("kind", "series")
        .neq("status", "cancelled"),
    ]);
    for (const event of (events ?? []) as { series_id: string; starts_at: string }[]) {
      const current = eventsBySeries.get(event.series_id) ?? { starts: event.starts_at, count: 0 };
      current.count += 1;
      if (event.starts_at < current.starts) {
        current.starts = event.starts_at;
      }
      eventsBySeries.set(event.series_id, current);
    }
    const bookingIds = ((bookings ?? []) as { id: string; series_id: string }[]).map((row) => row.id);
    const paid = new Set<string>();
    if (bookingIds.length > 0) {
      const { data: charges } = await supabase
        .from("charges")
        .select("series_booking_id")
        .in("series_booking_id", bookingIds)
        .eq("kind", "series")
        .eq("status", "paid");
      for (const charge of (charges ?? []) as { series_booking_id: string | null }[]) {
        if (charge.series_booking_id) {
          paid.add(charge.series_booking_id);
        }
      }
    }
    for (const booking of (bookings ?? []) as { id: string; series_id: string }[]) {
      const current = peopleBySeries.get(booking.series_id) ?? { taken: 0, paid: 0 };
      current.taken += 1;
      if (paid.has(booking.id)) {
        current.paid += 1;
      }
      peopleBySeries.set(booking.series_id, current);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[15px] font-semibold text-cream">Kursy</h1>
        <Link href="/admin/kursy/nowy" className="text-[13px] text-gold hover:text-gold-light">
          Nowy kurs
        </Link>
      </div>
      {series.length === 0 ? (
        <p className="text-[13px] text-muted">Nie ma jeszcze kursów.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {series.map((item) => {
            const when = eventsBySeries.get(item.id);
            const people = peopleBySeries.get(item.id) ?? { taken: 0, paid: 0 };
            const city = site.locations.find((location) => location.id === item.location_id)?.city;
            return (
              <li key={item.id} className="border border-white/10 bg-black-soft p-3">
                <Link href={`/admin/kursy/${item.id}`} className="text-cream hover:text-gold">
                  {item.title}
                </Link>
                <p className="mt-1 text-[13px] text-muted">
                  {when ? formatDateTimeWarsaw(when.starts) : "brak dat"}
                  {city ? ` · ${city}` : ""} · {when?.count ?? 0} spotkań · {people.taken}/
                  {item.capacity ?? "—"} zapisanych · {people.paid} opłaconych ·{" "}
                  {item.published ? "opublikowany" : "szkic"}
                  {item.signup_open ? "" : " · zapisy zamknięte"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
