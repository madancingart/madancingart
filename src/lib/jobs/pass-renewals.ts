import "server-only";

import { findPriceItem } from "@/content/pricing";
import { addDays } from "@/lib/billing/dates";
import { quotePass } from "@/lib/billing/engine";
import { passNotice } from "@/lib/billing/notices";
import { createCharge } from "@/lib/billing/repo";
import { formatBillingZloty } from "@/lib/billing/status";
import { loadClasses } from "@/lib/jobs/classes";
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

type PassEnrollment = {
  id: string;
  customerId: string;
  classId: string;
  paidUntil: string | null;
};

export async function runPassRenewals(ctx: JobContext): Promise<JobResult> {
  const result = blankResult("pass-renewals");
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("enrollments")
      .select("id, customer_id, recurring_class_id, paid_until")
      .eq("status", "active")
      .eq("billing_mode", "pass4");
    if (error) {
      throw new Error("Nie udało się wczytać karnetów.");
    }
    const enrollments: PassEnrollment[] = (
      (data ?? []) as {
        id: string;
        customer_id: string;
        recurring_class_id: string;
        paid_until: string | null;
      }[]
    )
      .map((row) => ({
        id: row.id,
        customerId: row.customer_id,
        classId: row.recurring_class_id,
        paidUntil: row.paid_until?.slice(0, 10) ?? null,
      }))
      .filter((row) => !row.paidUntil || row.paidUntil < ctx.today);
    if (enrollments.length === 0) {
      return finishResult(result);
    }
    const [classes, recipients, openPasses, remaining] = await Promise.all([
      loadClasses(enrollments.map((row) => row.classId)),
      loadRecipients(enrollments.map((row) => row.customerId)),
      loadOpenPasses(enrollments.map((row) => row.id)),
      loadRemaining(enrollments, ctx.today),
    ]);

    for (const enrollment of enrollments) {
      const cls = classes.get(enrollment.classId);
      const price = cls?.priceItemId ? findPriceItem(cls.priceItemId) : null;
      if (!cls || !price || price.billing !== "pass4" || price.amountCents <= 0) {
        result.skipped += 1;
        continue;
      }
      const left = remaining.get(`${enrollment.customerId}:${enrollment.classId}`) ?? 0;
      if (left > 1) {
        result.skipped += 1;
        continue;
      }
      const open = openPasses.get(enrollment.id);
      if (open) {
        if (open.reminderStage > 0) {
          result.skipped += 1;
          continue;
        }
        const delivered = await sendPass(ctx, {
          enrollmentId: enrollment.id,
          recipient: recipients.get(enrollment.customerId) ?? null,
          className: cls.name,
          location: cls.location,
          amountCents: open.amountCents,
          payToken: ctx.mode === "live" ? open.payToken : null,
        });
        if (delivered === "sent") {
          result.sent += 1;
          if (ctx.mode === "live") {
            await markStage(open.id, ctx.now.toISOString());
          }
        } else if (delivered === "failed") {
          result.errors.push(`Nie wysłano maila o karnecie, zapis ${enrollment.id}.`);
        } else {
          result.errors.push(`Brak adresu e-mail, zapis ${enrollment.id}.`);
        }
        continue;
      }

      if (ctx.mode === "dry-run") {
        result.created += 1;
        const delivered = await sendPass(ctx, {
          enrollmentId: enrollment.id,
          recipient: recipients.get(enrollment.customerId) ?? null,
          className: cls.name,
          location: cls.location,
          amountCents: price.amountCents,
          payToken: null,
        });
        if (delivered === "sent") {
          result.sent += 1;
        } else {
          result.errors.push(`Brak adresu e-mail, zapis ${enrollment.id}.`);
        }
        continue;
      }

      const quote = {
        ...quotePass({
          amountCents: price.amountCents,
          label: price.label,
          detail: price.detail,
        }),
        dueOn: addDays(ctx.today, 7),
      };
      const created = await createCharge({
        quote,
        customerId: enrollment.customerId,
        enrollmentId: enrollment.id,
        nowDate: ctx.today,
      });
      if (!created.created) {
        result.skipped += 1;
        continue;
      }
      result.created += 1;
      const { data: tokenRow } = await admin
        .from("charges")
        .select("pay_token")
        .eq("id", created.id)
        .maybeSingle();
      const payToken = (tokenRow as { pay_token: string } | null)?.pay_token ?? null;
      const delivered = await sendPass(ctx, {
        enrollmentId: enrollment.id,
        recipient: recipients.get(enrollment.customerId) ?? null,
        className: cls.name,
        location: cls.location,
        amountCents: price.amountCents,
        payToken,
      });
      if (delivered === "sent") {
        result.sent += 1;
        await markStage(created.id, ctx.now.toISOString());
      } else if (delivered === "failed") {
        result.errors.push(`Nie wysłano maila o karnecie, zapis ${enrollment.id}.`);
      } else {
        result.errors.push(`Brak adresu e-mail, zapis ${enrollment.id}.`);
      }
    }
  } catch (error) {
    result.errors.push(errorText(error));
  }
  return finishResult(result);
}

async function sendPass(
  ctx: JobContext,
  input: {
    enrollmentId: string;
    recipient: Recipient | null;
    className: string;
    location: string;
    amountCents: number;
    payToken: string | null;
  },
): Promise<"sent" | "skipped" | "failed"> {
  const notice = passNotice({
    name: input.recipient?.greetingName ?? "tam",
    className: input.className,
    location: input.location,
    amount: formatBillingZloty(input.amountCents),
  });
  return deliverClientMail(ctx, {
    job: "pass-renewals",
    recipient: input.recipient,
    subject: notice.subject,
    text: notice.text,
    amount: formatBillingZloty(input.amountCents),
    period: "karnet 4 wejść",
    payToken: input.payToken,
  });
}

async function markStage(chargeId: string, nowIso: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("charges")
    .update({ reminder_stage: 1, last_reminded_at: nowIso })
    .eq("id", chargeId);
}

async function loadOpenPasses(enrollmentIds: string[]): Promise<
  Map<string, { id: string; payToken: string; reminderStage: number; amountCents: number }>
> {
  const result = new Map<
    string,
    { id: string; payToken: string; reminderStage: number; amountCents: number }
  >();
  const admin = createAdminClient();
  for (const slice of chunk([...new Set(enrollmentIds)], 100)) {
    const { data, error } = await admin
      .from("charges")
      .select("id, enrollment_id, pay_token, reminder_stage, amount_cents")
      .eq("kind", "pass4")
      .eq("status", "open")
      .in("enrollment_id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać karnetów do opłacenia.");
    }
    for (const row of (data ?? []) as {
      id: string;
      enrollment_id: string;
      pay_token: string;
      reminder_stage: number;
      amount_cents: number;
    }[]) {
      result.set(row.enrollment_id, {
        id: row.id,
        payToken: row.pay_token,
        reminderStage: row.reminder_stage,
        amountCents: row.amount_cents,
      });
    }
  }
  return result;
}

async function loadRemaining(
  enrollments: PassEnrollment[],
  today: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const customerIds = [...new Set(enrollments.map((row) => row.customerId))];
  const classIds = new Set(enrollments.map((row) => row.classId));
  const admin = createAdminClient();
  const packages: {
    id: string;
    customer_id: string;
    recurring_class_id: string | null;
    total_lessons: number | null;
    valid_until: string | null;
  }[] = [];
  for (const slice of chunk(customerIds, 100)) {
    const { data, error } = await admin
      .from("packages")
      .select("id, customer_id, recurring_class_id, total_lessons, valid_until")
      .eq("status", "active")
      .in("kind", ["pass_4", "pass_8"])
      .in("customer_id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać karnetów.");
    }
    packages.push(
      ...((data ?? []) as {
        id: string;
        customer_id: string;
        recurring_class_id: string | null;
        total_lessons: number | null;
        valid_until: string | null;
      }[]),
    );
  }
  const active = packages.filter((item) => {
    if (!item.recurring_class_id || !classIds.has(item.recurring_class_id)) {
      return false;
    }
    const valid = item.valid_until?.slice(0, 10) ?? null;
    return !valid || valid >= today;
  });
  const used = new Map<string, number>();
  const packageIds = active.map((item) => item.id);
  for (const slice of chunk(packageIds, 100)) {
    const { data, error } = await admin
      .from("attendance")
      .select("package_id")
      .eq("present", true)
      .in("package_id", slice);
    if (error) {
      throw new Error("Nie udało się policzyć wejść.");
    }
    for (const row of (data ?? []) as { package_id: string | null }[]) {
      if (!row.package_id) {
        continue;
      }
      used.set(row.package_id, (used.get(row.package_id) ?? 0) + 1);
    }
  }
  for (const item of active) {
    if (!item.recurring_class_id || item.total_lessons == null) {
      continue;
    }
    const left = item.total_lessons - (used.get(item.id) ?? 0);
    const key = `${item.customer_id}:${item.recurring_class_id}`;
    result.set(key, Math.max(result.get(key) ?? 0, left));
  }
  return result;
}
