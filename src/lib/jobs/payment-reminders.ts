import "server-only";

import { reminderStageFor } from "@/lib/billing/reminder-stage";
import { paymentNotice } from "@/lib/billing/notices";
import { formatBillingZloty, monthNominative } from "@/lib/billing/status";
import { formatDatePl } from "@/lib/datetime";
import { loadClasses, locationCity } from "@/lib/jobs/classes";
import { chunk } from "@/lib/jobs/chunk";
import { deliverClientMail } from "@/lib/jobs/deliver";
import { loadRecipients, type Recipient } from "@/lib/jobs/recipients";
import {
  blankResult,
  errorText,
  finishResult,
  type JobContext,
  type JobResult,
} from "@/lib/jobs/types";
import { createAdminClient } from "@/lib/supabase/admin";

type ChargeRow = {
  id: string;
  customerId: string;
  enrollmentId: string | null;
  seriesBookingId: string | null;
  amountCents: number;
  dueDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  reminderStage: number;
  payToken: string;
  label: string;
};

type MailClass = {
  name: string;
  location: string;
  weekday: string;
  time: string;
};

export async function runPaymentReminders(ctx: JobContext): Promise<JobResult> {
  const result = blankResult("payment-reminders");
  try {
    const charges = await loadOpenCharges();
    const enrollmentIds = charges
      .map((row) => row.enrollmentId)
      .filter((id): id is string => Boolean(id));
    const seriesBookingIds = charges
      .map((row) => row.seriesBookingId)
      .filter((id): id is string => Boolean(id));
    const [enrollments, bookings, recipients] = await Promise.all([
      loadEnrollments(enrollmentIds),
      loadBookings(seriesBookingIds),
      loadRecipients(charges.map((row) => row.customerId)),
    ]);
    const classes = await loadClasses(
      [...enrollments.values()].map((row) => row.classId),
    );
    const series = await loadSeries([...bookings.values()].map((row) => row.seriesId));

    for (const charge of charges) {
      const enrollment = charge.enrollmentId
        ? enrollments.get(charge.enrollmentId)
        : undefined;
      if (enrollment && (enrollment.status === "ended" || enrollment.status === "paused")) {
        result.skipped += 1;
        continue;
      }
      const booking = charge.seriesBookingId
        ? bookings.get(charge.seriesBookingId)
        : undefined;
      if (booking?.status === "cancelled") {
        result.skipped += 1;
        continue;
      }
      const stage = reminderStageFor(
        {
          amountCents: charge.amountCents,
          dueDate: charge.dueDate,
          reminderStage: charge.reminderStage,
        },
        ctx.today,
      );
      if (!stage) {
        result.skipped += 1;
        continue;
      }
      const cls = mailClass(charge, enrollment?.classId, classes, booking?.seriesId, series);
      const recipient = recipientFor(charge, recipients, booking);
      const notice = paymentNotice(stage, {
        name: recipient?.greetingName ?? "tam",
        month: monthNominative(charge.periodStart ?? charge.dueDate) ?? "",
        amount: formatBillingZloty(charge.amountCents),
        className: cls.name,
        location: cls.location,
        weekday: cls.weekday,
        time: cls.time,
        due: formatDatePl(charge.dueDate),
      });
      const delivered = await deliverClientMail(ctx, {
        job: "payment-reminders",
        recipient,
        subject: notice.subject,
        text: notice.text,
        amount: formatBillingZloty(charge.amountCents),
        period: charge.periodStart
          ? `${charge.periodStart} – ${charge.periodEnd ?? charge.periodStart}`
          : charge.dueDate,
        payToken: charge.payToken,
      });
      if (delivered !== "sent") {
        if (delivered === "failed") {
          result.errors.push(`Nie wysłano przypomnienia, należność ${charge.id}.`);
        } else {
          result.errors.push(`Brak adresu e-mail, należność ${charge.id}.`);
        }
        continue;
      }
      result.sent += 1;
      if (ctx.mode === "live") {
        const admin = createAdminClient();
        const { error } = await admin
          .from("charges")
          .update({ reminder_stage: stage, last_reminded_at: ctx.now.toISOString() })
          .eq("id", charge.id)
          .eq("status", "open");
        if (error) {
          result.errors.push(`Mail wyszedł, ale nie zapisano etapu, należność ${charge.id}.`);
        }
      }
    }
  } catch (error) {
    result.errors.push(errorText(error));
  }
  return finishResult(result);
}

function recipientFor(
  charge: ChargeRow,
  recipients: Map<string, Recipient>,
  booking: { firstName: string; email: string | null } | undefined,
): Recipient | null {
  const known = recipients.get(charge.customerId) ?? null;
  if (known?.email) {
    return known;
  }
  if (booking?.email) {
    return {
      email: booking.email,
      greetingName: booking.firstName,
      participantLine: known?.participantLine ?? null,
      phone: known?.phone ?? "",
      displayName: known?.displayName ?? booking.firstName,
    };
  }
  return known;
}

function mailClass(
  charge: ChargeRow,
  classId: string | undefined,
  classes: Map<string, { name: string; location: string; weekday: string; time: string }>,
  seriesId: string | undefined,
  series: Map<string, { title: string; location: string }>,
): MailClass {
  if (classId) {
    const cls = classes.get(classId);
    if (cls) {
      return cls;
    }
  }
  const course = seriesId ? series.get(seriesId) : undefined;
  if (course) {
    return { name: course.title, location: course.location, weekday: "", time: "" };
  }
  return { name: charge.label, location: "", weekday: "", time: "" };
}

async function loadOpenCharges(): Promise<ChargeRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("charges")
    .select(
      "id, customer_id, enrollment_id, series_booking_id, amount_cents, due_date, period_start, period_end, reminder_stage, pay_token, label",
    )
    .eq("status", "open")
    .gt("amount_cents", 0);
  if (error) {
    throw new Error("Nie udało się wczytać otwartych należności.");
  }
  return (
    (data ?? []) as {
      id: string;
      customer_id: string;
      enrollment_id: string | null;
      series_booking_id: string | null;
      amount_cents: number;
      due_date: string;
      period_start: string | null;
      period_end: string | null;
      reminder_stage: number;
      pay_token: string;
      label: string;
    }[]
  ).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    enrollmentId: row.enrollment_id,
    seriesBookingId: row.series_booking_id,
    amountCents: row.amount_cents,
    dueDate: row.due_date.slice(0, 10),
    periodStart: row.period_start?.slice(0, 10) ?? null,
    periodEnd: row.period_end?.slice(0, 10) ?? null,
    reminderStage: row.reminder_stage,
    payToken: row.pay_token,
    label: row.label,
  }));
}

async function loadEnrollments(
  ids: string[],
): Promise<Map<string, { status: string; classId: string }>> {
  const result = new Map<string, { status: string; classId: string }>();
  const admin = createAdminClient();
  for (const slice of chunk([...new Set(ids)], 100)) {
    const { data, error } = await admin
      .from("enrollments")
      .select("id, status, recurring_class_id")
      .in("id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać zapisów.");
    }
    for (const row of (data ?? []) as {
      id: string;
      status: string;
      recurring_class_id: string;
    }[]) {
      result.set(row.id, { status: row.status, classId: row.recurring_class_id });
    }
  }
  return result;
}

async function loadBookings(ids: string[]): Promise<
  Map<string, { status: string; seriesId: string; firstName: string; email: string | null }>
> {
  const result = new Map<
    string,
    { status: string; seriesId: string; firstName: string; email: string | null }
  >();
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return result;
  }
  const admin = createAdminClient();
  for (const slice of chunk(unique, 100)) {
    const { data, error } = await admin
      .from("bookings")
      .select("id, status, series_id, first_name, email")
      .in("id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać rezerwacji.");
    }
    for (const row of (data ?? []) as {
      id: string;
      status: string;
      series_id: string | null;
      first_name: string;
      email: string | null;
    }[]) {
      if (!row.series_id) {
        continue;
      }
      result.set(row.id, {
        status: row.status,
        seriesId: row.series_id,
        firstName: row.first_name,
        email: row.email,
      });
    }
  }
  return result;
}

async function loadSeries(
  ids: string[],
): Promise<Map<string, { title: string; location: string }>> {
  const result = new Map<string, { title: string; location: string }>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return result;
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_series")
    .select("id, title, location_id")
    .in("id", unique);
  if (error) {
    throw new Error("Nie udało się wczytać kursów.");
  }
  for (const row of (data ?? []) as { id: string; title: string; location_id: string | null }[]) {
    result.set(row.id, { title: row.title, location: locationCity(row.location_id) });
  }
  return result;
}
