import "server-only";

import { findPriceItem, type LocatedPriceItem } from "@/content/pricing";
import type { BillingClass, BillingQuote } from "@/lib/billing/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EnrollmentBillingMode, EnrollmentStatus } from "@/lib/types";

export type EnrollmentBillingContext = {
  enrollment: {
    id: string;
    customerId: string;
    recurringClassId: string;
    status: EnrollmentStatus;
    billingMode: EnrollmentBillingMode;
    billingStart: string;
    paidUntil: string | null;
  };
  cls: BillingClass;
  priceItem: LocatedPriceItem | null;
  cancelledDates: string[];
};

type ClassEmbed = {
  weekday: number;
  start_time: string;
  price_item_id: string | null;
};

function oneClass(value: ClassEmbed | ClassEmbed[] | null): ClassEmbed | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function dateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

export async function loadEnrollmentContext(
  enrollmentId: string,
): Promise<EnrollmentBillingContext | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enrollments")
    .select(
      "id, customer_id, recurring_class_id, status, billing_mode, billing_start, paid_until, recurring_classes(weekday, start_time, price_item_id)",
    )
    .eq("id", enrollmentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    customer_id: string;
    recurring_class_id: string;
    status: EnrollmentStatus;
    billing_mode: EnrollmentBillingMode;
    billing_start: string;
    paid_until: string | null;
    recurring_classes: ClassEmbed | ClassEmbed[] | null;
  };
  const danceClass = oneClass(row.recurring_classes);
  if (!danceClass) {
    return null;
  }

  const { data: cancelled } = await admin
    .from("class_sessions")
    .select("session_date")
    .eq("recurring_class_id", row.recurring_class_id)
    .eq("status", "cancelled");

  return {
    enrollment: {
      id: row.id,
      customerId: row.customer_id,
      recurringClassId: row.recurring_class_id,
      status: row.status,
      billingMode: row.billing_mode,
      billingStart: dateOnly(row.billing_start) ?? row.billing_start,
      paidUntil: dateOnly(row.paid_until),
    },
    cls: {
      weekday: danceClass.weekday,
      startTime: danceClass.start_time.slice(0, 5),
    },
    priceItem: danceClass.price_item_id
      ? findPriceItem(danceClass.price_item_id)
      : null,
    cancelledDates: (cancelled ?? []).map((item) =>
      String(item.session_date).slice(0, 10),
    ),
  };
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || (error.message ?? "").toLowerCase().includes("duplicate key");
}

async function existingCharge(input: {
  enrollmentId: string;
  quote: BillingQuote;
}): Promise<{ id: string; status: "open" | "paid" | "void" } | null> {
  const admin = createAdminClient();
  const query = admin
    .from("charges")
    .select("id, status")
    .eq("enrollment_id", input.enrollmentId)
    .neq("status", "void")
    .limit(1);

  const filtered =
    input.quote.kind === "pass4"
      ? query.eq("kind", "pass4").eq("status", "open")
      : input.quote.periodStart
        ? query.eq("period_start", input.quote.periodStart)
        : query;

  const { data } = await filtered.maybeSingle();
  const row = data as { id: string; status: "open" | "paid" | "void" } | null;
  return row ?? null;
}

/** Wystawia należność. Konflikt unikalnego okresu zwraca już istniejącą, bez wyjątku. */
export async function createCharge(input: {
  quote: BillingQuote;
  customerId: string;
  enrollmentId: string;
  nowDate: string;
}): Promise<{ id: string; created: boolean; status: "open" | "paid" | "void" }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("charges")
    .insert({
      customer_id: input.customerId,
      enrollment_id: input.enrollmentId,
      kind: input.quote.kind,
      label: input.quote.lines.join(" · ") || "Należność",
      period_start: input.quote.periodStart,
      period_end: input.quote.periodEnd,
      sessions_count: input.quote.sessionDates.length || null,
      amount_cents: input.quote.amountCents,
      due_date: input.quote.dueOn ?? input.quote.periodStart ?? input.nowDate,
      status: "open",
      created_by: "system",
    })
    .select("id, status")
    .single();

  if (!error && data) {
    const row = data as { id: string; status: "open" | "paid" | "void" };
    return { id: row.id, created: true, status: row.status };
  }

  if (error && isUniqueViolation(error)) {
    const existing = await existingCharge({
      enrollmentId: input.enrollmentId,
      quote: input.quote,
    });
    if (existing) {
      return { id: existing.id, created: false, status: existing.status };
    }
  }

  throw new Error("Nie udało się wystawić należności.");
}

export async function createSeriesCharge(input: {
  customerId: string;
  seriesBookingId: string;
  amountCents: number;
  label: string;
  dueDate: string;
  sessionsCount: number;
}): Promise<{ id: string; created: boolean; status: "open" | "paid" | "void" }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("charges")
    .insert({
      customer_id: input.customerId,
      series_booking_id: input.seriesBookingId,
      kind: "series",
      label: input.label,
      sessions_count: input.sessionsCount,
      amount_cents: input.amountCents,
      due_date: input.dueDate,
      status: "open",
      created_by: "system",
    })
    .select("id, status")
    .single();

  if (!error && data) {
    const row = data as { id: string; status: "open" | "paid" | "void" };
    return { id: row.id, created: true, status: row.status };
  }

  if (error && isUniqueViolation(error)) {
    const { data: existing } = await admin
      .from("charges")
      .select("id, status")
      .eq("series_booking_id", input.seriesBookingId)
      .neq("status", "void")
      .limit(1)
      .maybeSingle();
    const row = existing as { id: string; status: "open" | "paid" | "void" } | null;
    if (row) {
      return { id: row.id, created: false, status: row.status };
    }
  }

  throw new Error("Nie udało się wystawić należności za kurs.");
}
