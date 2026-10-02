import "server-only";

import type Stripe from "stripe";
import { sendSeriesConfirmation } from "@/lib/courses/confirm";
import {
  sendChargePaidEmail,
  sendChargePaymentFailedEmail,
  sendVoidChargeReviewEmail,
} from "@/lib/email";
import { siteUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function chargeIdsFromSession(session: Stripe.Checkout.Session): string[] {
  return (session.metadata?.charge_ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => UUID.test(id));
}

export async function fulfillChargePayment(session: Stripe.Checkout.Session): Promise<void> {
  const ids = chargeIdsFromSession(session);
  if (ids.length === 0) {
    return;
  }

  const admin = createAdminClient();
  const booked: {
    label: string;
    amountCents: number;
    customerId: string;
    seriesBookingId: string | null;
  }[] = [];
  const enrollmentIds = new Set<string>();

  for (const chargeId of ids) {
    const { data, error } = await admin.rpc("apply_charge_payment", {
      p_charge_id: chargeId,
      p_method: "stripe",
      p_stripe_session_id: session.id,
    });
    if (error) {
      throw error;
    }

    const { data: charge } = await admin
      .from("charges")
      .select("label, amount_cents, customer_id, enrollment_id, series_booking_id, kind, status")
      .eq("id", chargeId)
      .maybeSingle();
    const row = charge as {
      label: string;
      amount_cents: number;
      customer_id: string;
      enrollment_id: string | null;
      series_booking_id: string | null;
      kind: string;
      status: string;
    } | null;
    if (!row) {
      continue;
    }
    if (row.enrollment_id) {
      enrollmentIds.add(row.enrollment_id);
    }
    if (data === "paid_void_needs_review") {
      await sendVoidChargeReviewEmail({
        amountCents: row.amount_cents,
        label: row.label,
        stripeUrl: stripePaymentUrl(session),
      });
      continue;
    }
    if (data === "ok") {
      booked.push({
        label: row.label,
        amountCents: row.amount_cents,
        customerId: row.customer_id,
        seriesBookingId: row.kind === "series" ? row.series_booking_id : null,
      });
    }
  }

  if (booked.length === 0) {
    return;
  }

  const courses = booked.filter((item) => item.seriesBookingId);
  const rest = booked.filter((item) => !item.seriesBookingId);
  const customerId = booked[0]?.customerId;
  if (rest.length > 0 && customerId) {
    const recipient = await chargeRecipient(customerId);
    const paidUntil = await latestPaidUntil([...enrollmentIds]);
    await sendChargePaidEmail({
      email: recipient.email,
      firstName: recipient.firstName,
      amountCents: rest.reduce((sum, item) => sum + item.amountCents, 0),
      lines: rest.map((item) => item.label),
      paidUntil,
    });
  }
  for (const course of courses) {
    if (course.seriesBookingId) {
      await sendSeriesConfirmation(course.seriesBookingId);
    }
  }
}

export async function notifyChargePaymentFailed(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const ids = chargeIdsFromSession(session);
  if (ids.length === 0) {
    return;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("charges")
    .select("pay_token, customer_id, period_start")
    .in("id", ids);
  const rows = (data ?? []) as {
    pay_token: string;
    customer_id: string;
    period_start: string | null;
  }[];
  const latest = rows
    .slice()
    .sort((left, right) => (right.period_start ?? "").localeCompare(left.period_start ?? ""))[0];
  if (!latest) {
    return;
  }
  const recipient = await chargeRecipient(latest.customer_id);
  await sendChargePaymentFailedEmail({
    email: recipient.email,
    firstName: recipient.firstName,
    retryUrl: `${siteUrl()}/zaplac/${latest.pay_token}`,
  });
}

function stripePaymentUrl(session: Stripe.Checkout.Session): string {
  const paymentIntent = session.payment_intent;
  const id = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
  const root = session.livemode
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";
  return id ? `${root}/payments/${id}` : `${root}/payments`;
}

async function latestPaidUntil(enrollmentIds: string[]): Promise<string | null> {
  if (enrollmentIds.length === 0) {
    return null;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("enrollments")
    .select("paid_until")
    .in("id", enrollmentIds);
  const dates = ((data ?? []) as { paid_until: string | null }[])
    .map((row) => row.paid_until?.slice(0, 10) ?? null)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates.at(-1) ?? null;
}

async function chargeRecipient(customerId: string): Promise<{ email: string; firstName: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("first_name, email, owner_user_id")
    .eq("id", customerId)
    .maybeSingle();
  const row = data as {
    first_name: string;
    email: string | null;
    owner_user_id: string | null;
  } | null;
  let email = row?.email?.trim() ?? "";
  if (row?.owner_user_id) {
    const user = await admin.auth.admin.getUserById(row.owner_user_id);
    email = user.data.user?.email?.trim() || email;
  }
  return { email, firstName: row?.first_name?.trim() || "tam" };
}
