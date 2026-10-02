import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseBoard } from "@/components/admin/courses/CourseBoard";
import { requireAdmin } from "@/lib/admin/require-admin";
import { customerDisplayName } from "@/lib/admin/customer-label";
import { site } from "@/content/site";
import { formatBillingZloty } from "@/lib/billing/status";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("event_series")
    .select("id, title, description, location_id, price_cents, capacity, published, signup_open, allow_single, single_price_cents")
    .eq("id", id)
    .maybeSingle();
  const course = data as {
    id: string;
    title: string;
    description: string | null;
    location_id: string | null;
    price_cents: number;
    capacity: number | null;
    published: boolean;
    signup_open: boolean;
    allow_single: boolean;
    single_price_cents: number | null;
  } | null;
  if (!course) {
    notFound();
  }
  const [{ data: events }, { data: bookings }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, cancelled_at")
      .eq("series_id", course.id)
      .order("starts_at"),
    supabase
      .from("bookings")
      .select("id, customer_id, first_name, last_name, email, phone, status, customers(kind, partner_first_name, partner_last_name, guardian_name)")
      .eq("series_id", course.id)
      .eq("kind", "series")
      .neq("status", "cancelled"),
  ]);
  const sessions = ((events ?? []) as {
    id: string;
    title: string;
    starts_at: string;
    cancelled_at: string | null;
  }[]).map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    cancelled: Boolean(row.cancelled_at),
  }));
  const peopleRows = (bookings ?? []) as {
    id: string;
    customer_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    customers:
      | {
          kind: "adult" | "pair" | "child";
          partner_first_name: string | null;
          partner_last_name: string | null;
          guardian_name: string | null;
        }
      | {
          kind: "adult" | "pair" | "child";
          partner_first_name: string | null;
          partner_last_name: string | null;
          guardian_name: string | null;
        }[]
      | null;
  }[];
  const bookingIds = peopleRows.map((row) => row.id);
  const paymentByBooking = new Map<string, string>();
  if (bookingIds.length > 0) {
    const { data: charges } = await supabase
      .from("charges")
      .select("series_booking_id, status, amount_cents")
      .in("series_booking_id", bookingIds)
      .eq("kind", "series")
      .neq("status", "void");
    for (const charge of (charges ?? []) as {
      series_booking_id: string;
      status: string;
      amount_cents: number;
    }[]) {
      paymentByBooking.set(
        charge.series_booking_id,
        charge.status === "paid" ? `opłacone ${formatBillingZloty(charge.amount_cents)}` : "do zapłaty",
      );
    }
  }
  const customerIds = peopleRows
    .map((row) => row.customer_id)
    .filter((value): value is string => Boolean(value));
  const present: string[] = [];
  if (customerIds.length > 0 && sessions.length > 0) {
    const { data: attendance } = await supabase
      .from("attendance")
      .select("event_id, customer_id, present")
      .in(
        "event_id",
        sessions.map((item) => item.id),
      )
      .eq("present", true);
    for (const row of (attendance ?? []) as { event_id: string; customer_id: string }[]) {
      present.push(`${row.event_id}:${row.customer_id}`);
    }
  }
  const city = site.locations.find((item) => item.id === course.location_id)?.city;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/kursy" className="text-[13px] text-gold hover:text-gold-light">
        Wróć do listy
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-cream">{course.title}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {city ?? "Sala"} · {formatBillingZloty(course.price_cents)} ·{" "}
          {course.published ? "opublikowany" : "szkic"}
          {course.allow_single && course.single_price_cents
            ? ` · pojedyncze ${formatBillingZloty(course.single_price_cents)}`
            : ""}
        </p>
        {course.description ? <p className="mt-3 text-[14px] text-cream">{course.description}</p> : null}
      </div>
      <CourseBoard
        seriesId={course.id}
        signupOpen={course.signup_open}
        sessions={sessions}
        present={present}
        people={peopleRows.flatMap((row) => {
          if (!row.customer_id) {
            return [];
          }
          const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
          return [
            {
              bookingId: row.id,
              customerId: row.customer_id,
              name: customer
                ? customerDisplayName({
                    kind: customer.kind,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    partnerFirstName: customer.partner_first_name,
                    partnerLastName: customer.partner_last_name,
                    guardianName: customer.guardian_name,
                  })
                : `${row.first_name} ${row.last_name}`,
              email: row.email,
              phone: row.phone,
              payment: paymentByBooking.get(row.id) ?? "brak należności",
            },
          ];
        })}
      />
    </div>
  );
}
