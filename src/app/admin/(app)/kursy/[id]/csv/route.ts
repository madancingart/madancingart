import { requireAdmin } from "@/lib/admin/require-admin";
import { slugifyCourseTitle } from "@/lib/courses/schedule";

function cell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { supabase } = await requireAdmin();
  const [{ data: series }, { data: events }, { data: bookings }] = await Promise.all([
    supabase.from("event_series").select("title").eq("id", id).maybeSingle(),
    supabase.from("events").select("id, starts_at").eq("series_id", id).order("starts_at"),
    supabase
      .from("bookings")
      .select("id, customer_id, first_name, last_name, email, phone")
      .eq("series_id", id)
      .eq("kind", "series")
      .neq("status", "cancelled"),
  ]);
  const title = (series as { title: string } | null)?.title ?? "kurs";
  const sessions = (events ?? []) as { id: string; starts_at: string }[];
  const people = (bookings ?? []) as {
    id: string;
    customer_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  }[];
  const bookingIds = people.map((row) => row.id);
  const paid = new Set<string>();
  if (bookingIds.length > 0) {
    const { data: charges } = await supabase
      .from("charges")
      .select("series_booking_id")
      .in("series_booking_id", bookingIds)
      .eq("status", "paid");
    for (const charge of (charges ?? []) as { series_booking_id: string | null }[]) {
      if (charge.series_booking_id) {
        paid.add(charge.series_booking_id);
      }
    }
  }
  const marks = new Set<string>();
  if (sessions.length > 0) {
    const { data: attendance } = await supabase
      .from("attendance")
      .select("event_id, customer_id")
      .in(
        "event_id",
        sessions.map((item) => item.id),
      )
      .eq("present", true);
    for (const row of (attendance ?? []) as { event_id: string; customer_id: string }[]) {
      marks.add(`${row.event_id}:${row.customer_id}`);
    }
  }
  const header = ["imie", "nazwisko", "email", "telefon", "platnosc", ...sessions.map((item) => item.starts_at.slice(0, 10))];
  const lines = [
    header.map(cell).join(";"),
    ...people.map((person) =>
      [
        person.first_name,
        person.last_name,
        person.email,
        person.phone,
        paid.has(person.id) ? "oplacone" : "do zaplaty",
        ...sessions.map((session) =>
          person.customer_id && marks.has(`${session.id}:${person.customer_id}`) ? "obecny" : "",
        ),
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugifyCourseTitle(title) || "kurs"}.csv"`,
    },
  });
}
