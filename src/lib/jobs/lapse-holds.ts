import "server-only";

import { formatBillingZloty } from "@/lib/billing/status";
import { lapseNotice } from "@/lib/billing/notices";
import { hasStripeSecret, getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClasses } from "@/lib/jobs/classes";
import { deliverClientMail } from "@/lib/jobs/deliver";
import { loadRecipients, type Recipient } from "@/lib/jobs/recipients";
import { chunk } from "@/lib/jobs/chunk";
import {
  blankResult,
  errorText,
  finishResult,
  type JobContext,
  type JobResult,
} from "@/lib/jobs/types";

const HOLD_MS = 72 * 60 * 60 * 1000;
const VOID_REASON = "nieopłacone w 72 h";

type OpenCharge = {
  id: string;
  amount_cents: number;
  pay_token: string;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

async function expireSession(sessionId: string | null, errors: string[]): Promise<void> {
  if (!sessionId) {
    return;
  }
  if (!hasStripeSecret()) {
    if (!errors.includes("Brak Stripe — nie wygaszono sesji płatności.")) {
      errors.push("Brak Stripe — nie wygaszono sesji płatności.");
    }
    return;
  }
  try {
    await getStripe().checkout.sessions.expire(sessionId);
  } catch (error) {
    const message = errorText(error);
    if (/expired/i.test(message)) {
      return;
    }
    errors.push(message);
  }
}

export async function runLapseHolds(ctx: JobContext): Promise<JobResult> {
  const result = blankResult("lapse-holds");
  try {
    const admin = createAdminClient();
    const { data: pending, error } = await admin
      .from("enrollments")
      .select("id, customer_id, recurring_class_id")
      .eq("status", "pending")
      .lt("hold_expires_at", ctx.now.toISOString());
    if (error) {
      throw new Error("Nie udało się wczytać wygasających miejsc.");
    }
    const holds = (pending ?? []) as {
      id: string;
      customer_id: string;
      recurring_class_id: string;
    }[];
    const classes = await loadClasses(holds.map((row) => row.recurring_class_id));
    const recipients = await loadRecipients(holds.map((row) => row.customer_id));
    const chargesByEnrollment = await openChargesBy(
      holds.map((row) => row.id),
      "enrollment_id",
    );

    for (const hold of holds) {
      const charges = chargesByEnrollment.get(hold.id) ?? [];
      const label = classes.get(hold.recurring_class_id);
      const released = await releaseHold(ctx, {
        id: hold.id,
        charges,
        recipient: recipients.get(hold.customer_id) ?? null,
        className: label?.name ?? "zajęcia",
        table: "enrollments",
        result,
      });
      if (released) {
        result.created += 1;
      }
    }

    await lapseSeries(ctx, result);
  } catch (error) {
    result.errors.push(errorText(error));
  }
  return finishResult(result);
}

async function lapseSeries(ctx: JobContext, result: JobResult): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("id, customer_id, first_name, email, series_id")
    .eq("kind", "series")
    .eq("status", "pending");
  if (error) {
    throw new Error("Nie udało się wczytać rezerwacji kursów.");
  }
  const bookings = (data ?? []) as {
    id: string;
    customer_id: string | null;
    first_name: string;
    email: string | null;
    series_id: string;
  }[];
  if (bookings.length === 0) {
    return;
  }
  const chargesByBooking = await openChargesBy(
    bookings.map((row) => row.id),
    "series_booking_id",
  );
  const cutoff = ctx.now.getTime() - HOLD_MS;
  const stale = bookings.filter((booking) =>
    (chargesByBooking.get(booking.id) ?? []).some(
      (charge) => Date.parse(charge.created_at) < cutoff,
    ),
  );
  const seriesTitles = await loadSeriesTitles(stale.map((row) => row.series_id));
  const recipients = await loadRecipients(
    stale.map((row) => row.customer_id).filter((id): id is string => Boolean(id)),
  );

  for (const booking of stale) {
    const charges = (chargesByBooking.get(booking.id) ?? []).filter(
      (charge) => Date.parse(charge.created_at) < cutoff,
    );
    const series = seriesTitles.get(booking.series_id);
    const recipient =
      (booking.customer_id ? recipients.get(booking.customer_id) : null) ??
      (booking.email
        ? {
            email: booking.email,
            greetingName: booking.first_name,
            participantLine: null,
            phone: "",
            displayName: booking.first_name,
          }
        : null);
    const released = await releaseHold(ctx, {
      id: booking.id,
      charges,
      recipient,
      className: series?.title ?? "kurs",
      table: "bookings",
      result,
    });
    if (released) {
      result.created += 1;
    }
  }
}

async function releaseHold(
  ctx: JobContext,
  input: {
    id: string;
    charges: OpenCharge[];
    recipient: Recipient | null;
    className: string;
    table: "enrollments" | "bookings";
    result: JobResult;
  },
): Promise<boolean> {
  const notice = lapseNotice({
    name: input.recipient?.greetingName ?? "tam",
    className: input.className,
  });
  const amountCents = input.charges.reduce((sum, charge) => sum + charge.amount_cents, 0);
  const payToken = [...input.charges].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  )[0]?.pay_token;

  if (ctx.mode === "dry-run") {
    const delivered = await deliverClientMail(ctx, {
      job: "lapse-holds",
      recipient: input.recipient,
      subject: notice.subject,
      text: notice.text,
      amount: amountCents > 0 ? formatBillingZloty(amountCents) : null,
      period: input.charges.some((charge) => charge.stripe_checkout_session_id)
        ? "wygaśnięcie miejsca, sesja Stripe"
        : "wygaśnięcie miejsca",
      payToken: payToken ?? null,
    });
    if (delivered === "sent") {
      input.result.sent += 1;
    } else {
      input.result.errors.push(`Brak adresu e-mail, zapis ${input.id}.`);
    }
    return true;
  }

  for (const charge of input.charges) {
    await expireSession(charge.stripe_checkout_session_id, input.result.errors);
  }
  const admin = createAdminClient();
  for (const charge of input.charges) {
    const { error } = await admin
      .from("charges")
      .update({ status: "void", void_reason: VOID_REASON })
      .eq("id", charge.id)
      .eq("status", "open");
    if (error) {
      input.result.errors.push(`Nie udało się anulować należności, zapis ${input.id}.`);
      return false;
    }
  }

  if (input.table === "enrollments") {
    const { data, error } = await admin
      .from("enrollments")
      .update({ status: "lapsed" })
      .eq("id", input.id)
      .eq("status", "pending")
      .select("id");
    if (error || (data ?? []).length === 0) {
      input.result.skipped += 1;
      return false;
    }
  } else {
    const { data, error } = await admin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", input.id)
      .eq("status", "pending")
      .select("id");
    if (error || (data ?? []).length === 0) {
      input.result.skipped += 1;
      return false;
    }
  }

  const delivered = await deliverClientMail(ctx, {
    job: "lapse-holds",
    recipient: input.recipient,
    subject: notice.subject,
    text: notice.text,
    amount: amountCents > 0 ? formatBillingZloty(amountCents) : null,
    period: "wygaśnięcie miejsca",
    payToken: payToken ?? null,
  });
  if (delivered === "sent") {
    input.result.sent += 1;
  } else if (delivered === "failed") {
    input.result.errors.push(`Nie wysłano maila o wygaśnięciu, zapis ${input.id}.`);
  } else {
    input.result.errors.push(`Brak adresu e-mail, zapis ${input.id}.`);
  }
  return true;
}

async function openChargesBy(
  ids: string[],
  column: "enrollment_id" | "series_booking_id",
): Promise<Map<string, OpenCharge[]>> {
  const result = new Map<string, OpenCharge[]>();
  if (ids.length === 0) {
    return result;
  }
  const admin = createAdminClient();
  for (const slice of chunk([...new Set(ids)], 100)) {
    const { data, error } = await admin
      .from("charges")
      .select("id, amount_cents, pay_token, stripe_checkout_session_id, created_at, enrollment_id, series_booking_id")
      .eq("status", "open")
      .in(column, slice);
    if (error) {
      throw new Error("Nie udało się wczytać należności.");
    }
    for (const row of (data ?? []) as (OpenCharge & {
      enrollment_id: string | null;
      series_booking_id: string | null;
    })[]) {
      const key = column === "enrollment_id" ? row.enrollment_id : row.series_booking_id;
      if (!key) {
        continue;
      }
      const list = result.get(key) ?? [];
      list.push(row);
      result.set(key, list);
    }
  }
  return result;
}

async function loadSeriesTitles(seriesIds: string[]): Promise<Map<string, { title: string }>> {
  const result = new Map<string, { title: string }>();
  const ids = [...new Set(seriesIds)];
  if (ids.length === 0) {
    return result;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("event_series").select("id, title").in("id", ids);
  if (error) {
    throw new Error("Nie udało się wczytać kursów.");
  }
  for (const row of (data ?? []) as { id: string; title: string }[]) {
    result.set(row.id, { title: row.title });
  }
  return result;
}
