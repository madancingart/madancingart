import "server-only";

import { revalidatePath } from "next/cache";
import { enrollmentBillingMode } from "@/content/pricing";
import { loadBillableClass } from "@/lib/billing/class-price";
import { site } from "@/content/site";
import { warsawNow } from "@/lib/billing/dates";
import {
  quoteFirst,
  quotePass,
  quotePrepaid,
  type BillingQuote,
} from "@/lib/billing/engine";
import { createCheckout } from "@/lib/billing/checkout";
import { chargesForCheckout, type CheckoutCharge } from "@/lib/billing/charge-set";
import { isEnrollmentCovered, alreadyCoveredMessage } from "@/lib/billing/offer-copy";
import { createCharge } from "@/lib/billing/repo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPaymentsEnabled } from "@/lib/validation";

export type EnrollResult =
  | { ok: true; alreadyCovered: true; message: string }
  | { ok: true; skipped: true; message: string }
  | { ok: true; checkoutUrl: string }
  | { ok: true; onsite: true; message: string }
  | { ok: false; status: number; error: string };

type EnrollRow = {
  enrollment_id: string;
  is_new: boolean;
};

export async function enrollInClass(input: {
  customerId: string;
  classId: string;
  plan: "period" | "prepaid";
}): Promise<EnrollResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Zaloguj się, żeby zapisać się na zajęcia.",
    };
  }

  const billable = await loadBillableClass(input.classId);
  if (!billable || !billable.priceItem) {
    return {
      ok: false,
      status: 409,
      error: `Ta grupa nie ma jeszcze ceny. Zadzwoń: ${site.phone}.`,
    };
  }
  const billingMode = enrollmentBillingMode(billable.priceItem);
  if (!billingMode) {
    return {
      ok: false,
      status: 409,
      error: `Te zajęcia rozliczamy ręcznie. Zadzwoń: ${site.phone}.`,
    };
  }

  const { data, error } = await supabase.rpc("enroll_in_class", {
    p_customer_id: input.customerId,
    p_class_id: input.classId,
  });

  if (error) {
    return mapEnrollError(error.message);
  }

  const row = firstRow(data);
  if (!row) {
    return {
      ok: false,
      status: 500,
      error: "Nie udało się zapisać. Spróbuj ponownie za chwilę.",
    };
  }

  const admin = createAdminClient();
  await admin
    .from("enrollments")
    .update({ billing_mode: billingMode })
    .eq("id", row.enrollment_id);

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("paid_until, billing_start")
    .eq("id", row.enrollment_id)
    .maybeSingle();
  const paidUntil = dateOnly(
    (enrollment as { paid_until: string | null } | null)?.paid_until ?? null,
  );
  const billingStart =
    dateOnly(
      (enrollment as { billing_start: string | null } | null)?.billing_start ?? null,
    ) ?? warsawNow().date;

  const now = warsawNow();
  const pass = await loadPass(input.customerId, input.classId);
  if (
    !row.is_new &&
    isEnrollmentCovered({
      today: now.date,
      paidUntil,
      passRemaining: pass.remaining,
      passValidUntil: pass.validUntil,
    })
  ) {
    revalidatePath("/konto");
    return { ok: true, alreadyCovered: true, message: alreadyCoveredMessage(paidUntil) };
  }

  const open = await loadOpenCharges(row.enrollment_id);
  if (!row.is_new && open.length > 0) {
    return finishPayment(open.map((charge) => charge.id), false);
  }

  const quote = buildQuote({
    cls: billable.cls,
    monthlyCents: billable.priceItem.amountCents,
    billing: billingMode,
    plan: input.plan,
    today: now.date,
    nowTime: now.time,
    paidUntil,
    billingStart,
    cancelled: billable.cancelledDates,
    promo: billable.priceItem.prepaid
      ? {
          amountCents: billable.priceItem.prepaid.amountCents,
          label: billable.priceItem.prepaid.label,
        }
      : undefined,
    passLabel: billable.priceItem.label,
    passDetail: billable.priceItem.detail,
  });
  quote.dueOn = now.date;
  if (quote.amountCents === 0) {
    quote.kind = "skip";
  }

  let charge: { id: string; status: "open" | "paid" | "void" };
  try {
    charge = await createCharge({
      quote,
      customerId: input.customerId,
      enrollmentId: row.enrollment_id,
      nowDate: now.date,
    });
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Nie udało się wystawić należności. Spróbuj ponownie za chwilę.",
    };
  }

  if (quote.amountCents === 0) {
    try {
      await settleSkip(charge.id, row.enrollment_id);
    } catch {
      return {
        ok: false,
        status: 500,
        error: "Zapisaliśmy Cię, ale nie udało się domknąć tego okresu. Spróbuj ponownie.",
      };
    }
    revalidatePath("/grafik");
    revalidatePath("/konto");
    return {
      ok: true,
      skipped: true,
      message: "Zapis przyjęty. W tym okresie nie ma zajęć do opłacenia.",
    };
  }

  return finishPayment([charge.id], true);
}

function buildQuote(input: {
  cls: { weekday: number; startTime: string };
  monthlyCents: number;
  billing: "monthly" | "pass4";
  plan: "period" | "prepaid";
  today: string;
  nowTime: string;
  paidUntil: string | null;
  billingStart: string;
  cancelled: string[];
  promo?: { amountCents: number; label: string };
  passLabel: string;
  passDetail?: string;
}): BillingQuote {
  if (input.billing === "pass4") {
    return quotePass({
      amountCents: input.monthlyCents,
      label: input.passLabel,
      detail: input.passDetail,
    });
  }
  if (input.plan === "prepaid") {
    return quotePrepaid(
      input.cls,
      input.monthlyCents,
      3,
      input.paidUntil,
      input.billingStart,
      input.today,
      input.promo,
      input.cancelled,
    );
  }
  return quoteFirst(
    input.cls,
    input.monthlyCents,
    input.today,
    input.nowTime,
    input.cancelled,
  );
}

async function finishPayment(chargeIds: string[], createdHold: boolean): Promise<EnrollResult> {
  revalidatePath("/grafik");
  revalidatePath("/konto");
  if (!isPaymentsEnabled()) {
    return {
      ok: true,
      onsite: true,
      message: createdHold
        ? "Zapis przyjęty. Zapłacisz na sali. Miejsce trzymamy przez 72 godziny."
        : "Masz już otwartą należność. Zapłacisz na sali. Miejsce trzymamy przez 72 godziny.",
    };
  }

  try {
    const checkout = await createCheckout(chargeIds);
    return { ok: true, checkoutUrl: checkout.url };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Zapisaliśmy Cię, ale nie udało się otworzyć płatności. Spróbuj ponownie.",
    };
  }
}

async function settleSkip(chargeId: string, enrollmentId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_charge_payment", {
    p_charge_id: chargeId,
    p_method: "legacy",
    p_stripe_session_id: null,
  });
  if (error) {
    throw new Error("Nie udało się domknąć bezpłatnego okresu.");
  }
  if (data === "already_paid") {
    await admin
      .from("enrollments")
      .update({ status: "active", hold_expires_at: null })
      .eq("id", enrollmentId)
      .in("status", ["pending", "lapsed"]);
  }
}

async function loadOpenCharges(enrollmentId: string): Promise<CheckoutCharge[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("charges")
    .select(
      "id, customer_id, enrollment_id, status, amount_cents, label, period_start, stripe_checkout_session_id",
    )
    .eq("enrollment_id", enrollmentId)
    .eq("status", "open");

  return chargesForCheckout(
    ((data ?? []) as {
      id: string;
      customer_id: string;
      enrollment_id: string | null;
      status: "open" | "paid" | "void";
      amount_cents: number;
      label: string;
      period_start: string | null;
      stripe_checkout_session_id: string | null;
    }[]).map((row) => ({
      id: row.id,
      status: row.status,
      periodStart: row.period_start?.slice(0, 10) ?? null,
      customerId: row.customer_id,
      amountCents: row.amount_cents,
      label: row.label,
      enrollmentId: row.enrollment_id,
      stripeSessionId: row.stripe_checkout_session_id,
    })),
  );
}

async function loadPass(
  customerId: string,
  classId: string,
): Promise<{ remaining: number; validUntil: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("packages")
    .select("id, total_lessons, valid_until")
    .eq("customer_id", customerId)
    .eq("recurring_class_id", classId)
    .eq("status", "active")
    .in("kind", ["pass_4", "pass_8"]);

  const packages = (data ?? []) as {
    id: string;
    total_lessons: number;
    valid_until: string | null;
  }[];
  if (packages.length === 0) {
    return { remaining: 0, validUntil: null };
  }

  const { data: attendance } = await admin
    .from("attendance")
    .select("package_id")
    .eq("present", true)
    .in(
      "package_id",
      packages.map((item) => item.id),
    );
  const used = new Map<string, number>();
  for (const row of (attendance ?? []) as { package_id: string | null }[]) {
    if (!row.package_id) {
      continue;
    }
    used.set(row.package_id, (used.get(row.package_id) ?? 0) + 1);
  }

  let remaining = 0;
  let validUntil: string | null = null;
  for (const item of packages) {
    const left = item.total_lessons - (used.get(item.id) ?? 0);
    if (left > remaining) {
      remaining = left;
      validUntil = dateOnly(item.valid_until);
    }
  }
  return { remaining, validUntil };
}

function mapEnrollError(message: string): EnrollResult {
  const text = message.toLowerCase();
  if (text.includes("class_full")) {
    return {
      ok: false,
      status: 409,
      error: `Grupa właśnie się zapełniła — wybierz inny termin albo zadzwoń: ${site.phone}`,
    };
  }
  if (text.includes("class_closed")) {
    return { ok: false, status: 409, error: "Zapisy do tej grupy są zamknięte" };
  }
  if (text.includes("forbidden")) {
    return {
      ok: false,
      status: 403,
      error: "Nie możesz zapisać tej osoby na zajęcia.",
    };
  }
  return {
    ok: false,
    status: 500,
    error: "Nie udało się zapisać. Spróbuj ponownie za chwilę.",
  };
}

function firstRow(data: unknown): EnrollRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return null;
  }
  const record = row as { enrollment_id?: unknown; is_new?: unknown };
  if (typeof record.enrollment_id !== "string" || typeof record.is_new !== "boolean") {
    return null;
  }
  return { enrollment_id: record.enrollment_id, is_new: record.is_new };
}

function dateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}
