import "server-only";

import { enrollmentBillingMode } from "@/content/pricing";
import { quoteFirst, quotePass } from "@/lib/billing/engine";
import { coverageWindow } from "@/lib/billing/coverage";
import { addDays, addMonths, startOfMonth } from "@/lib/billing/dates";
import { paymentNotice } from "@/lib/billing/notices";
import { createCharge } from "@/lib/billing/repo";
import { formatBillingZloty, monthNominative } from "@/lib/billing/status";
import { loadBillableClass } from "@/lib/billing/class-price";
import { formatDatePl, weekdayLongLabel } from "@/lib/datetime";
import { sendBillingNoticeEmail } from "@/lib/email";
import { hasStripeSecret, getStripe, siteUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { site } from "@/content/site";
import { warsawNow } from "@/lib/billing/dates";

export type MoneyResult = { ok: true; message: string } | { ok: false; error: string };

function fail(error: string): MoneyResult {
  return { ok: false, error };
}

function todayDate(): string {
  return warsawNow().date;
}

export async function recordChargePayment(input: {
  chargeId: string;
  method: "onsite" | "transfer";
  paidOn: string;
}): Promise<MoneyResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_charge_payment", {
    p_charge_id: input.chargeId,
    p_method: input.method,
    p_stripe_session_id: null,
    p_paid_at: `${input.paidOn}T12:00:00+02:00`,
  });
  if (error) {
    return fail("Nie udało się odnotować wpłaty.");
  }
  if (data === "already_paid") {
    return { ok: true, message: "Ta należność jest już opłacona." };
  }
  if (data === "paid_void_needs_review") {
    return fail("Wpłata weszła na anulowaną należność. Sprawdź ją w Stripe.");
  }
  await admin.from("charges").update({ note: `Data wpłaty: ${input.paidOn}` }).eq("id", input.chargeId);
  return { ok: true, message: "Wpłata odnotowana." };
}

export async function voidOpenCharge(input: {
  chargeId: string;
  reason: string;
}): Promise<MoneyResult> {
  const reason = input.reason.trim();
  if (!reason) {
    return fail("Podaj powód anulowania.");
  }
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("charges")
    .select("stripe_checkout_session_id")
    .eq("id", input.chargeId)
    .maybeSingle();
  const sessionId =
    (existing as { stripe_checkout_session_id: string | null } | null)
      ?.stripe_checkout_session_id ?? null;
  const { data, error } = await admin.rpc("void_charge", {
    p_charge_id: input.chargeId,
    p_reason: reason,
  });
  if (error) {
    const message = error.message.includes("charge_paid")
      ? "Opłaconej należności nie da się anulować."
      : "Nie udało się anulować należności.";
    return fail(message);
  }
  if (sessionId && hasStripeSecret()) {
    try {
      await getStripe().checkout.sessions.expire(sessionId);
    } catch {
      // Sesja mogła już wygasnąć. Należność i tak jest anulowana.
    }
  }
  if (typeof data === "string") {
    await admin.rpc("recompute_paid_until", { p_enrollment_id: data });
  }
  return { ok: true, message: "Należność anulowana." };
}

export async function changeChargeDueDate(input: {
  chargeId: string;
  dueDate: string;
}): Promise<MoneyResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("charges")
    .update({ due_date: input.dueDate, reminder_stage: 1, last_reminded_at: null })
    .eq("id", input.chargeId)
    .eq("status", "open")
    .select("id");
  if (error || (data ?? []).length === 0) {
    return fail("Termin można zmienić tylko przy otwartej należności.");
  }
  return { ok: true, message: "Termin płatności zmieniony." };
}

export async function sendChargeReminderNow(chargeId: string): Promise<MoneyResult> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("charges")
    .select(
      "id, customer_id, enrollment_id, amount_cents, due_date, period_start, status, pay_token, label, reminder_stage",
    )
    .eq("id", chargeId)
    .maybeSingle();
  const charge = data as {
    id: string;
    customer_id: string;
    enrollment_id: string | null;
    amount_cents: number;
    due_date: string;
    period_start: string | null;
    status: string;
    pay_token: string;
    label: string;
    reminder_stage: number;
  } | null;
  if (!charge || charge.status !== "open" || charge.amount_cents <= 0) {
    return fail("Tej należności nie ma już do opłacenia.");
  }
  const { data: customer } = await admin
    .from("customers")
    .select("first_name, email, kind")
    .eq("id", charge.customer_id)
    .maybeSingle();
  const person = customer as { first_name: string; email: string | null; kind: string } | null;
  if (!person?.email) {
    return fail("Brak adresu e-mail.");
  }
  let className = charge.label;
  let location = "";
  let weekday = "";
  let time = "";
  if (charge.enrollment_id) {
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("recurring_class_id")
      .eq("id", charge.enrollment_id)
      .maybeSingle();
    const classId = (enrollment as { recurring_class_id: string } | null)?.recurring_class_id;
    if (classId) {
      const { data: cls } = await admin
        .from("recurring_classes")
        .select("weekday, start_time, location_id, class_types(name)")
        .eq("id", classId)
        .maybeSingle();
      const row = cls as {
        weekday: number;
        start_time: string;
        location_id: string;
        class_types: { name: string } | { name: string }[] | null;
      } | null;
      const type = Array.isArray(row?.class_types) ? row?.class_types[0] : row?.class_types;
      className = type?.name ?? className;
      location = site.locations.find((item) => item.id === row?.location_id)?.city ?? "";
      weekday = row ? weekdayLongLabel(row.weekday) : "";
      time = row?.start_time.slice(0, 5) ?? "";
    }
  }
  const stage = charge.reminder_stage >= 2 && charge.reminder_stage <= 4 ? charge.reminder_stage : 2;
  const notice = paymentNotice(stage as 2 | 3 | 4, {
    name: person.first_name,
    month: monthNominative(charge.period_start ?? charge.due_date) ?? "",
    amount: formatBillingZloty(charge.amount_cents),
    className,
    location,
    weekday,
    time,
    due: formatDatePl(charge.due_date.slice(0, 10)),
  });
  const sent = await sendBillingNoticeEmail({
    to: person.email,
    subject: notice.subject,
    text: notice.text,
    participantLine: null,
    payUrl: `${siteUrl()}/zaplac/${charge.pay_token}`,
  });
  if (!sent) {
    return fail("Nie udało się wysłać przypomnienia.");
  }
  return { ok: true, message: "Przypomnienie wysłane. Etap automatu bez zmian." };
}

export async function setEnrollmentPaidUntil(input: {
  enrollmentId: string;
  until: string;
  amountCents: number;
  method: "onsite" | "transfer" | "legacy";
  note: string;
}): Promise<MoneyResult> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("enrollments")
    .select("id, customer_id, started_on, paid_until, status")
    .eq("id", input.enrollmentId)
    .maybeSingle();
  const enrollment = data as {
    id: string;
    customer_id: string;
    started_on: string;
    paid_until: string | null;
    status: string;
  } | null;
  if (!enrollment || enrollment.status === "ended") {
    return fail("Nie znaleziono aktywnego zapisu.");
  }
  const window = coverageWindow({
    paidUntil: enrollment.paid_until?.slice(0, 10) ?? null,
    startedOn: enrollment.started_on.slice(0, 10),
    until: input.until,
  });
  if ("error" in window) {
    return fail(window.error);
  }
  const methodLabel =
    input.method === "onsite" ? "gotówka" : input.method === "transfer" ? "przelew" : "metoda nieznana";
  const description = [input.note.trim() || "Przedpłata sprzed systemu", methodLabel].join(" · ");
  const created = await createCharge({
    quote: {
      kind: "manual",
      amountCents: input.amountCents,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      sessionDates: [],
      issueOn: todayDate(),
      dueOn: todayDate(),
      lines: [description],
    },
    customerId: enrollment.customer_id,
    enrollmentId: enrollment.id,
    nowDate: todayDate(),
  });
  const { error } = await admin.rpc("apply_charge_payment", {
    p_charge_id: created.id,
    p_method: "legacy",
    p_stripe_session_id: null,
  });
  if (error) {
    return fail("Należność powstała, ale nie udało się jej zaksięgować.");
  }
  await admin.from("audit_log").insert({
    actor_label: "admin",
    action: "paid_until.set",
    entity: "enrollment",
    entity_id: enrollment.id,
    customer_id: enrollment.customer_id,
    details: {
      until: input.until,
      amount_cents: input.amountCents,
      method: input.method,
      note: description,
    },
  });
  return { ok: true, message: `Opłacone do ${formatDatePl(input.until)}.` };
}

export async function addCustomerToClass(input: {
  customerId: string;
  classId: string;
  skipFirstPayment: boolean;
  enroll: () => Promise<{ enrollmentId: string; isNew: boolean } | { error: string }>;
}): Promise<MoneyResult> {
  const enrolled = await input.enroll();
  if ("error" in enrolled) {
    return fail(enrolled.error);
  }
  const admin = createAdminClient();
  if (!enrolled.isNew) {
    return { ok: true, message: "Ta osoba jest już w grupie." };
  }
  const billable = await loadBillableClass(input.classId);
  const mode = billable?.priceItem
    ? enrollmentBillingMode(billable.priceItem)
    : null;
  if (mode) {
    await admin.from("enrollments").update({ billing_mode: mode }).eq("id", enrolled.enrollmentId);
  }
  if (input.skipFirstPayment) {
    const nextMonth = addMonths(startOfMonth(todayDate()), 1);
    await admin
      .from("enrollments")
      .update({
        status: "active",
        hold_expires_at: null,
        billing_start: nextMonth,
      })
      .eq("id", enrolled.enrollmentId)
      .eq("status", "pending");
    return { ok: true, message: "Dodano bez pierwszej płatności. Rozliczenie od następnego miesiąca." };
  }
  if (!billable?.priceItem || !mode) {
    return fail("Ustaw cenę grupy albo zaznacz „bez pierwszej płatności”.");
  }
  const today = todayDate();
  const quote =
    mode === "pass4"
      ? { ...quotePass(billable.priceItem), dueOn: addDays(today, 4) }
      : quoteFirst(
          billable.cls,
          billable.priceItem.amountCents,
          today,
          "12:00",
          billable.cancelledDates,
        );
  await createCharge({
    quote: { ...quote, dueOn: today },
    customerId: input.customerId,
    enrollmentId: enrolled.enrollmentId,
    nowDate: today,
  });
  return {
    ok: true,
    message: "Miejsce czeka na pierwszą wpłatę. Odnotujesz ją w rozliczeniach.",
  };
}

export async function pauseEnrollment(input: {
  enrollmentId: string;
  from: string;
  until: string;
}): Promise<MoneyResult> {
  if (input.until < input.from) {
    return fail("Data końca przerwy jest wcześniejsza niż początek.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enrollments")
    .update({ status: "paused", paused_from: input.from, paused_until: input.until })
    .eq("id", input.enrollmentId)
    .in("status", ["active", "paused"])
    .select("id");
  if (error || (data ?? []).length === 0) {
    return fail("Nie udało się wstrzymać zapisu.");
  }
  return { ok: true, message: "Zapis wstrzymany. Bot nie wystawi należności za tę przerwę." };
}

export async function endEnrollment(input: {
  enrollmentId: string;
  endedOn: string;
}): Promise<MoneyResult> {
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("enrollments")
    .update({ status: "ended", ended_on: input.endedOn })
    .eq("id", input.enrollmentId)
    .in("status", ["active", "paused", "pending"])
    .select("id");
  if (error || (updated ?? []).length === 0) {
    return fail("Nie udało się zakończyć zapisu.");
  }
  const { data: charges } = await admin
    .from("charges")
    .select("id, period_start, stripe_checkout_session_id")
    .eq("enrollment_id", input.enrollmentId)
    .eq("status", "open");
  for (const charge of (charges ?? []) as {
    id: string;
    period_start: string | null;
    stripe_checkout_session_id: string | null;
  }[]) {
    if (!charge.period_start || charge.period_start.slice(0, 10) <= input.endedOn) {
      continue;
    }
    await voidOpenCharge({ chargeId: charge.id, reason: "Zapis zakończony" });
  }
  await admin.rpc("recompute_paid_until", { p_enrollment_id: input.enrollmentId });
  return { ok: true, message: "Zapis zakończony." };
}

export async function transferEnrollment(input: {
  enrollmentId: string;
  targetClassId: string;
  enroll: (customerId: string, classId: string) => Promise<
    { enrollmentId: string; isNew: boolean } | { error: string }
  >;
}): Promise<MoneyResult> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("enrollments")
    .select("id, customer_id, paid_until, recurring_class_id, status")
    .eq("id", input.enrollmentId)
    .maybeSingle();
  const current = data as {
    id: string;
    customer_id: string;
    paid_until: string | null;
    recurring_class_id: string;
    status: string;
  } | null;
  if (!current || current.status === "ended") {
    return fail("Nie znaleziono zapisu do przeniesienia.");
  }
  const created = await input.enroll(current.customer_id, input.targetClassId);
  if ("error" in created) {
    return fail(created.error);
  }
  if (!created.isNew) {
    return fail("Ta osoba jest już w wybranej grupie.");
  }
  const { data: sourceClass } = await admin
    .from("recurring_classes")
    .select("class_types(name)")
    .eq("id", current.recurring_class_id)
    .maybeSingle();
  const type = (sourceClass as { class_types: { name: string } | { name: string }[] | null } | null)
    ?.class_types;
  const sourceName = (Array.isArray(type) ? type[0]?.name : type?.name) ?? "poprzedniej grupy";
  const today = todayDate();
  const ended = await endEnrollment({ enrollmentId: current.id, endedOn: today });
  if (!ended.ok) {
    return ended;
  }
  const paidUntil = current.paid_until?.slice(0, 10) ?? null;
  if (!paidUntil) {
    await admin
      .from("enrollments")
      .update({ status: "active", hold_expires_at: null })
      .eq("id", created.enrollmentId)
      .eq("status", "pending");
    return { ok: true, message: `Przeniesiono z ${sourceName}.` };
  }
  const { data: fresh } = await admin
    .from("enrollments")
    .select("started_on")
    .eq("id", created.enrollmentId)
    .maybeSingle();
  const startedOn = (fresh as { started_on: string } | null)?.started_on.slice(0, 10) ?? today;
  if (paidUntil < startedOn) {
    await admin
      .from("enrollments")
      .update({ status: "active", hold_expires_at: null })
      .eq("id", created.enrollmentId);
    return { ok: true, message: `Przeniesiono z ${sourceName}. Pokrycie już minęło.` };
  }
  const charge = await createCharge({
    quote: {
      kind: "manual",
      amountCents: 0,
      periodStart: startedOn,
      periodEnd: paidUntil,
      sessionDates: [],
      issueOn: today,
      dueOn: today,
      lines: [`Przeniesienie z ${sourceName}`],
    },
    customerId: current.customer_id,
    enrollmentId: created.enrollmentId,
    nowDate: today,
  });
  const { error } = await admin.rpc("apply_charge_payment", {
    p_charge_id: charge.id,
    p_method: "legacy",
    p_stripe_session_id: null,
  });
  if (error) {
    return fail("Zapis przeniesiony, ale nie udało się przenieść opłacenia.");
  }
  return { ok: true, message: `Przeniesiono z ${sourceName}. Opłacone do zostaje.` };
}
