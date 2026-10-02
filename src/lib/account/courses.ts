import "server-only";

import { cache } from "react";
import { customerDisplayName } from "@/lib/admin/customer-label";
import { payChargeHref } from "@/lib/account/redirect";
import { chargeStatusPill, type BillingTone } from "@/lib/billing/status";
import { formatDateTimeWarsaw, warsawTodayIso } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import type { MyParticipantRow } from "@/lib/types";

export type AccountCourseSession = {
  id: string;
  when: string;
  cancelled: boolean;
  present: boolean | null;
};

export type AccountCourseCard = {
  id: string;
  title: string;
  participant: string;
  tone: BillingTone;
  label: string;
  payHref: string | null;
  sessions: AccountCourseSession[];
};

export const loadMyCourses = cache(async (): Promise<AccountCourseCard[] | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const [{ data: bookingData, error }, { data: peopleData }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, customer_id, series_id, first_name, last_name")
      .eq("kind", "series")
      .neq("status", "cancelled")
      .not("series_id", "is", null),
    supabase.rpc("my_participants"),
  ]);
  if (error) {
    return null;
  }
  const bookings = (bookingData ?? []) as {
    id: string;
    customer_id: string | null;
    series_id: string;
    first_name: string;
    last_name: string | null;
  }[];
  if (bookings.length === 0) {
    return [];
  }
  const people = new Map(
    ((peopleData ?? []) as MyParticipantRow[]).map((person) => [person.id, person]),
  );
  const seriesIds = [...new Set(bookings.map((row) => row.series_id))];
  const bookingIds = bookings.map((row) => row.id);
  const [{ data: seriesData }, { data: eventData }, { data: chargeData }] = await Promise.all([
    supabase.from("event_series").select("id, title, slug").in("id", seriesIds),
    supabase
      .from("events")
      .select("id, series_id, starts_at, cancelled_at")
      .in("series_id", seriesIds)
      .order("starts_at"),
    supabase
      .from("charges")
      .select("id, series_booking_id, status, due_date")
      .in("series_booking_id", bookingIds)
      .eq("kind", "series")
      .neq("status", "void"),
  ]);
  const titles = new Map(
    ((seriesData ?? []) as { id: string; title: string }[]).map((row) => [row.id, row.title]),
  );
  const events = (eventData ?? []) as {
    id: string;
    series_id: string;
    starts_at: string;
    cancelled_at: string | null;
  }[];
  const charges = (chargeData ?? []) as {
    id: string;
    series_booking_id: string;
    status: "open" | "paid" | "void";
    due_date: string;
  }[];
  const eventIds = events.map((event) => event.id);
  const marks = new Map<string, boolean>();
  if (eventIds.length > 0) {
    const { data: attendance } = await supabase
      .from("attendance")
      .select("event_id, customer_id, present")
      .in("event_id", eventIds);
    for (const row of (attendance ?? []) as {
      event_id: string;
      customer_id: string;
      present: boolean;
    }[]) {
      marks.set(`${row.event_id}:${row.customer_id}`, row.present);
    }
  }
  const today = warsawTodayIso();

  return bookings.flatMap((booking) => {
    const title = titles.get(booking.series_id);
    if (!title) {
      return [];
    }
    const person = booking.customer_id ? people.get(booking.customer_id) : undefined;
    const charge = charges.find((item) => item.series_booking_id === booking.id);
    const payment = charge
      ? chargeStatusPill(charge.status, charge.due_date, today)
      : { tone: "pending" as const, label: "Oczekuje na płatność" };
    return [
      {
        id: booking.id,
        title,
        participant: person
          ? customerDisplayName({
              kind: person.kind,
              firstName: person.first_name,
              lastName: person.last_name,
              partnerFirstName: person.partner_first_name,
              partnerLastName: person.partner_last_name,
            })
          : [booking.first_name, booking.last_name].filter(Boolean).join(" "),
        tone: payment.tone,
        label: payment.label,
        payHref: charge?.status === "open" ? payChargeHref(charge.id) : null,
        sessions: events
          .filter((event) => event.series_id === booking.series_id)
          .map((event) => ({
            id: event.id,
            when: formatDateTimeWarsaw(event.starts_at),
            cancelled: Boolean(event.cancelled_at),
            present: booking.customer_id
              ? (marks.get(`${event.id}:${booking.customer_id}`) ?? null)
              : null,
          })),
      },
    ];
  });
});
