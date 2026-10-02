import "server-only";

import { findPriceItem } from "@/content/pricing";
import { quoteNextMonthly, type BillingQuote } from "@/lib/billing/engine";
import {
  effectiveIssueOn,
  naturalIssueOn,
  shouldSpreadIssues,
} from "@/lib/billing/issue-spread";
import { paymentNotice } from "@/lib/billing/notices";
import { createCharge } from "@/lib/billing/repo";
import { formatBillingZloty, monthNominative } from "@/lib/billing/status";
import { formatDatePl } from "@/lib/datetime";
import { loadCancelledDates, loadClasses, type ClassRecord } from "@/lib/jobs/classes";
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

const SKIP_LINE = "Przerwa — brak zajęć w tym miesiącu";

type EnrollmentRow = {
  id: string;
  customerId: string;
  classId: string;
  billingStart: string;
  paidUntil: string | null;
};

type ExistingCharge = {
  id: string;
  periodStart: string;
  periodEnd: string | null;
  status: "open" | "paid" | "void";
  amountCents: number;
  reminderStage: number;
  payToken: string;
  dueDate: string;
  kind: string;
};

type Ready = {
  enrollment: EnrollmentRow;
  cls: ClassRecord;
  monthlyCents: number;
  cancelled: string[];
  charges: Map<string, ExistingCharge>;
  recipient: Recipient | null;
};

export async function runMonthlyCharges(ctx: JobContext): Promise<JobResult> {
  const result = blankResult("monthly-charges");
  try {
    const { ready, unpriced } = await loadReady();
    result.skipped += unpriced;
    const twentieth = `${ctx.today.slice(0, 7)}-20`;
    const cohort = ready.filter((item) => landsOnTwentieth(item, twentieth)).length;
    const spread = shouldSpreadIssues(cohort);
    result.detail = `Maile 20. dnia bez rozłożenia: ${cohort}. Rozłożenie na 18.–22.: ${spread ? "tak" : "nie"}.`;
    for (const item of ready) {
      try {
        await issueEnrollment(ctx, item, spread, result);
      } catch (error) {
        result.errors.push(errorText(error));
      }
    }
  } catch (error) {
    result.errors.push(errorText(error));
  }
  return finishResult(result);
}

async function loadReady(): Promise<{ ready: Ready[]; unpriced: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enrollments")
    .select("id, customer_id, recurring_class_id, billing_start, paid_until")
    .eq("status", "active")
    .eq("billing_mode", "monthly");
  if (error) {
    throw new Error("Nie udało się wczytać zapisów miesięcznych.");
  }
  const enrollments: EnrollmentRow[] = (
    (data ?? []) as {
      id: string;
      customer_id: string;
      recurring_class_id: string;
      billing_start: string;
      paid_until: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    classId: row.recurring_class_id,
    billingStart: row.billing_start.slice(0, 10),
    paidUntil: row.paid_until?.slice(0, 10) ?? null,
  }));
  const classIds = enrollments.map((row) => row.classId);
  const [classes, cancelled, charges, recipients] = await Promise.all([
    loadClasses(classIds),
    loadCancelledDates(classIds),
    loadCharges(enrollments.map((row) => row.id)),
    loadRecipients(enrollments.map((row) => row.customerId)),
  ]);
  const ready: Ready[] = [];
  let unpriced = 0;
  for (const enrollment of enrollments) {
    const cls = classes.get(enrollment.classId);
    const price = cls?.priceItemId ? findPriceItem(cls.priceItemId) : null;
    if (!cls || !price) {
      unpriced += 1;
      continue;
    }
    ready.push({
      enrollment,
      cls,
      monthlyCents: price.amountCents,
      cancelled: cancelled.get(enrollment.classId) ?? [],
      charges: charges.get(enrollment.id) ?? new Map(),
      recipient: recipients.get(enrollment.customerId) ?? null,
    });
  }
  return { ready, unpriced };
}

function landsOnTwentieth(item: Ready, twentieth: string): boolean {
  let cursor = item.enrollment.paidUntil;
  for (let step = 0; step < 24; step += 1) {
    const quote = quoteNextMonthly(
      item.cls.billing,
      item.monthlyCents,
      cursor,
      item.enrollment.billingStart,
      item.cancelled,
    );
    if (!quote.periodStart || !quote.periodEnd) {
      return false;
    }
    const issueOn = naturalIssueOn(quote);
    if (!issueOn) {
      return false;
    }
    if (issueOn === twentieth && quote.amountCents > 0) {
      return true;
    }
    if (issueOn > twentieth) {
      return false;
    }
    const existing = item.charges.get(quote.periodStart);
    cursor = laterEnd(quote.periodEnd, existing?.periodEnd);
  }
  return false;
}

async function issueEnrollment(
  ctx: JobContext,
  item: Ready,
  spread: boolean,
  result: JobResult,
): Promise<void> {
  let cursor = item.enrollment.paidUntil;
  let createdHere = 0;
  for (let step = 0; step < 24 && createdHere < 3; step += 1) {
    const quote = quoteNextMonthly(
      item.cls.billing,
      item.monthlyCents,
      cursor,
      item.enrollment.billingStart,
      item.cancelled,
    );
    if (!quote.periodStart || !quote.periodEnd) {
      return;
    }
    const issueOn = naturalIssueOn(quote);
    if (!issueOn) {
      return;
    }
    const effective = effectiveIssueOn(issueOn, item.enrollment.id, spread);
    if (ctx.today < effective) {
      return;
    }
    const existing = item.charges.get(quote.periodStart);
    if (existing) {
      const resent = await resendIssuance(ctx, item, existing, quote, result);
      if (resent === "failed") {
        return;
      }
      cursor = laterEnd(quote.periodEnd, existing.periodEnd);
      continue;
    }
    if (quote.amountCents === 0) {
      await issueSkip(ctx, item, quote, result);
      createdHere += 1;
      cursor = quote.periodEnd;
      continue;
    }
    const created = await issuePayable(ctx, item, quote, result);
    if (!created) {
      return;
    }
    createdHere += 1;
    cursor = quote.periodEnd;
  }
}

async function resendIssuance(
  ctx: JobContext,
  item: Ready,
  existing: ExistingCharge,
  quote: BillingQuote,
  result: JobResult,
): Promise<"sent" | "skipped" | "failed"> {
  if (existing.status === "open" && existing.amountCents === 0) {
    if (ctx.mode === "live") {
      await settleSkip(existing.id);
    }
    result.skipped += 1;
    return "skipped";
  }
  const canResend =
    existing.status === "open" &&
    existing.amountCents > 0 &&
    existing.reminderStage === 0 &&
    (existing.kind === "monthly" || existing.kind === "first");
  if (!canResend) {
    result.skipped += 1;
    return "skipped";
  }
  const delivered = await sendStageOne(ctx, item, {
    amountCents: existing.amountCents,
    dueDate: existing.dueDate,
    periodStart: quote.periodStart,
    periodEnd: quote.periodEnd,
    payToken: ctx.mode === "live" ? existing.payToken : null,
  });
  if (delivered === "sent") {
    result.sent += 1;
    if (ctx.mode === "live") {
      await markStage(existing.id, ctx.now.toISOString());
    }
    return "sent";
  }
  if (delivered === "failed") {
    result.errors.push(`Nie wysłano rozliczenia, zapis ${item.enrollment.id}.`);
    return "failed";
  }
  result.errors.push(`Brak adresu e-mail, zapis ${item.enrollment.id}.`);
  return "skipped";
}

async function issueSkip(
  ctx: JobContext,
  item: Ready,
  quote: BillingQuote,
  result: JobResult,
): Promise<void> {
  if (ctx.mode === "dry-run") {
    result.created += 1;
    return;
  }
  const created = await createCharge({
    quote: {
      ...quote,
      kind: "skip",
      amountCents: 0,
      lines: [SKIP_LINE],
      dueOn: quote.periodStart,
    },
    customerId: item.enrollment.customerId,
    enrollmentId: item.enrollment.id,
    nowDate: ctx.today,
  });
  if (created.created) {
    result.created += 1;
  } else {
    result.skipped += 1;
  }
  if (created.status === "open") {
    await settleSkip(created.id);
  }
  const admin = createAdminClient();
  await admin.from("charges").update({ note: SKIP_LINE }).eq("id", created.id);
}

async function issuePayable(
  ctx: JobContext,
  item: Ready,
  quote: BillingQuote,
  result: JobResult,
): Promise<boolean> {
  if (ctx.mode === "dry-run") {
    result.created += 1;
    const delivered = await sendStageOne(ctx, item, {
      amountCents: quote.amountCents,
      dueDate: quote.dueOn ?? quote.periodStart ?? ctx.today,
      periodStart: quote.periodStart,
      periodEnd: quote.periodEnd,
      payToken: null,
    });
    if (delivered === "sent") {
      result.sent += 1;
    } else {
      result.errors.push(`Brak adresu e-mail, zapis ${item.enrollment.id}.`);
    }
    return true;
  }
  const created = await createCharge({
    quote,
    customerId: item.enrollment.customerId,
    enrollmentId: item.enrollment.id,
    nowDate: ctx.today,
  });
  if (!created.created) {
    result.skipped += 1;
    return true;
  }
  result.created += 1;
  const admin = createAdminClient();
  const { data } = await admin
    .from("charges")
    .select("pay_token, due_date")
    .eq("id", created.id)
    .maybeSingle();
  const row = data as { pay_token: string; due_date: string } | null;
  if (!row?.pay_token) {
    result.errors.push(`Brak linku do płatności, zapis ${item.enrollment.id}.`);
    return false;
  }
  const delivered = await sendStageOne(ctx, item, {
    amountCents: quote.amountCents,
    dueDate: row.due_date.slice(0, 10),
    periodStart: quote.periodStart,
    periodEnd: quote.periodEnd,
    payToken: row.pay_token,
  });
  if (delivered === "sent") {
    result.sent += 1;
    await markStage(created.id, ctx.now.toISOString());
    return true;
  }
  if (delivered === "failed") {
    result.errors.push(`Nie wysłano rozliczenia, zapis ${item.enrollment.id}.`);
    return false;
  }
  result.errors.push(`Brak adresu e-mail, zapis ${item.enrollment.id}.`);
  return true;
}

async function sendStageOne(
  ctx: JobContext,
  item: Ready,
  charge: {
    amountCents: number;
    dueDate: string;
    periodStart: string | null;
    periodEnd: string | null;
    payToken: string | null;
  },
): Promise<"sent" | "skipped" | "failed"> {
  const notice = paymentNotice(1, {
    name: item.recipient?.greetingName ?? "tam",
    month: monthNominative(charge.periodStart) ?? "",
    amount: formatBillingZloty(charge.amountCents),
    className: item.cls.name,
    location: item.cls.location,
    weekday: item.cls.weekday,
    time: item.cls.time,
    due: formatDatePl(charge.dueDate),
  });
  return deliverClientMail(ctx, {
    job: "monthly-charges",
    recipient: item.recipient,
    subject: notice.subject,
    text: notice.text,
    amount: formatBillingZloty(charge.amountCents),
    period: periodLabel(charge.periodStart, charge.periodEnd),
    payToken: charge.payToken,
  });
}

function periodLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) {
    return null;
  }
  return `${start} – ${end}`;
}

function laterEnd(quoteEnd: string, existingEnd: string | null | undefined): string {
  if (existingEnd && existingEnd > quoteEnd) {
    return existingEnd;
  }
  return quoteEnd;
}

async function settleSkip(chargeId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_charge_payment", {
    p_charge_id: chargeId,
    p_method: "legacy",
    p_stripe_session_id: null,
  });
  if (error) {
    throw new Error("Nie udało się domknąć przerwy.");
  }
}

async function markStage(chargeId: string, nowIso: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("charges")
    .update({ reminder_stage: 1, last_reminded_at: nowIso })
    .eq("id", chargeId);
}

async function loadCharges(enrollmentIds: string[]): Promise<Map<string, Map<string, ExistingCharge>>> {
  const result = new Map<string, Map<string, ExistingCharge>>();
  const ids = [...new Set(enrollmentIds)];
  if (ids.length === 0) {
    return result;
  }
  const admin = createAdminClient();
  for (const slice of chunk(ids, 100)) {
    const { data, error } = await admin
      .from("charges")
      .select(
        "id, enrollment_id, period_start, period_end, status, amount_cents, reminder_stage, pay_token, due_date, kind",
      )
      .in("enrollment_id", slice)
      .neq("status", "void")
      .not("period_start", "is", null);
    if (error) {
      throw new Error("Nie udało się wczytać należności.");
    }
    for (const row of (data ?? []) as {
      id: string;
      enrollment_id: string;
      period_start: string;
      period_end: string | null;
      status: "open" | "paid" | "void";
      amount_cents: number;
      reminder_stage: number;
      pay_token: string;
      due_date: string;
      kind: string;
    }[]) {
      const map = result.get(row.enrollment_id) ?? new Map<string, ExistingCharge>();
      map.set(row.period_start.slice(0, 10), {
        id: row.id,
        periodStart: row.period_start.slice(0, 10),
        periodEnd: row.period_end?.slice(0, 10) ?? null,
        status: row.status,
        amountCents: row.amount_cents,
        reminderStage: row.reminder_stage,
        payToken: row.pay_token,
        dueDate: row.due_date.slice(0, 10),
        kind: row.kind,
      });
      result.set(row.enrollment_id, map);
    }
  }
  return result;
}
