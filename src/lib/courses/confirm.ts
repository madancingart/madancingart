import "server-only";

import { buildCourseIcs } from "@/lib/courses/ics";
import { formatDateTimeWarsaw } from "@/lib/datetime";
import { sendCourseEnrolledEmail } from "@/lib/email";
import { site } from "@/content/site";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendSeriesConfirmation(bookingId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, series_id, customer_id, first_name, email")
    .eq("id", bookingId)
    .maybeSingle();
  const row = booking as {
    series_id: string | null;
    customer_id: string | null;
    first_name: string;
    email: string;
  } | null;
  if (!row?.series_id) {
    return;
  }
  const [{ data: series }, { data: events }] = await Promise.all([
    admin.from("event_series").select("title, location_id").eq("id", row.series_id).maybeSingle(),
    admin
      .from("events")
      .select("id, title, starts_at, ends_at, location_id")
      .eq("series_id", row.series_id)
      .is("cancelled_at", null)
      .order("starts_at", { ascending: true }),
  ]);
  const course = series as { title: string; location_id: string | null } | null;
  const sessions = (events ?? []) as {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location_id: string | null;
  }[];
  if (!course || sessions.length === 0) {
    return;
  }
  const place = (locationId: string | null) => {
    const location = site.locations.find((item) => item.id === locationId);
    return [location?.city, location?.address].filter(Boolean).join(", ");
  };
  const ics = buildCourseIcs(
    sessions.map((session) => ({
      uid: `${session.id}@madancing.art`,
      start: new Date(session.starts_at),
      end: new Date(session.ends_at),
      summary: session.title,
      location: place(session.location_id ?? course.location_id),
    })),
    new Date(),
  );
  await sendCourseEnrolledEmail({
    email: row.email,
    firstName: row.first_name,
    title: course.title,
    dates: sessions.map((session) => formatDateTimeWarsaw(session.starts_at)),
    ics,
  });
}
