import "server-only";

import { enrollmentBillingMode } from "@/content/pricing";
import { site } from "@/content/site";
import { loadBillableClass } from "@/lib/billing/class-price";
import { warsawNow } from "@/lib/billing/dates";
import { quoteFirst, quotePass, quotePrepaid } from "@/lib/billing/engine";
import {
  alreadyCoveredMessage,
  describeFirstPayment,
  describePrepaid,
  isEnrollmentCovered,
  passChoiceLabel,
  prepaidChoiceLabel,
} from "@/lib/billing/offer-copy";
import { formatBillingZloty } from "@/lib/billing/status";
import { createClient } from "@/lib/supabase/server";

export type EnrollmentPreview =
  | { kind: "covered"; message: string }
  | { kind: "open"; message: string }
  | {
      kind: "offer";
      billing: "monthly" | "pass4";
      periodSummary: string;
      prepaidSummary: string | null;
      prepaidChoice: string | null;
      passChoice: string | null;
    }
  | { kind: "unavailable"; message: string };

export async function previewEnrollment(input: {
  classId: string;
  customerId: string;
}): Promise<EnrollmentPreview> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { kind: "unavailable", message: "Zaloguj się, żeby zobaczyć kwotę." };
  }

  const { data: participants } = await supabase.rpc("my_participants");
  const owns = ((participants ?? []) as { id: string }[]).some(
    (person) => person.id === input.customerId,
  );
  if (!owns) {
    return { kind: "unavailable", message: "Wybierz uczestnika ze swojego konta." };
  }

  const billable = await loadBillableClass(input.classId);
  if (!billable?.priceItem) {
    return {
      kind: "unavailable",
      message: `Ta grupa nie ma jeszcze ceny. Zadzwoń: ${site.phone}.`,
    };
  }
  const billing = enrollmentBillingMode(billable.priceItem);
  if (!billing) {
    return {
      kind: "unavailable",
      message: `Te zajęcia rozliczamy ręcznie. Zadzwoń: ${site.phone}.`,
    };
  }

  const now = warsawNow();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, paid_until")
    .eq("customer_id", input.customerId)
    .eq("recurring_class_id", input.classId)
    .in("status", ["pending", "active", "paused"])
    .maybeSingle();
  const enrollmentRow = enrollment as { id: string; paid_until: string | null } | null;
  const paidUntil = enrollmentRow?.paid_until?.slice(0, 10) ?? null;
  const pass = enrollmentRow
    ? await passRemaining(supabase, input.customerId, input.classId)
    : { remaining: 0, validUntil: null };

  if (
    enrollmentRow &&
    isEnrollmentCovered({
      today: now.date,
      paidUntil,
      passRemaining: pass.remaining,
      passValidUntil: pass.validUntil,
    })
  ) {
    return { kind: "covered", message: alreadyCoveredMessage(paidUntil) };
  }

  if (enrollmentRow) {
    const { data: openCharges } = await supabase
      .from("charges")
      .select("label, amount_cents")
      .eq("enrollment_id", enrollmentRow.id)
      .eq("status", "open");
    const open = (openCharges ?? []) as { label: string; amount_cents: number }[];
    if (open.length > 0) {
      const sum = open.reduce((total, charge) => total + charge.amount_cents, 0);
      const labels = open.map((charge) => charge.label).join(". ");
      return {
        kind: "open",
        message: `Do zapłaty: ${formatBillingZloty(sum)} — ${labels}. Nowa należność nie powstanie.`,
      };
    }
  }

  if (billing === "pass4") {
    const passQuote = quotePass({
      amountCents: billable.priceItem.amountCents,
      label: billable.priceItem.label,
      detail: billable.priceItem.detail,
    });
    return {
      kind: "offer",
      billing,
      periodSummary: passQuote.lines.join(". "),
      prepaidSummary: null,
      prepaidChoice: null,
      passChoice: passChoiceLabel(passQuote.amountCents),
    };
  }

  const first = quoteFirst(
    billable.cls,
    billable.priceItem.amountCents,
    now.date,
    now.time,
    billable.cancelledDates,
  );
  const prepaid = quotePrepaid(
    billable.cls,
    billable.priceItem.amountCents,
    billable.priceItem.prepaid?.months ?? 3,
    paidUntil,
    now.date,
    now.date,
    billable.priceItem.prepaid
      ? {
          amountCents: billable.priceItem.prepaid.amountCents,
          label: billable.priceItem.prepaid.label,
        }
      : undefined,
    billable.cancelledDates,
  );

  return {
    kind: "offer",
    billing,
    periodSummary: describeFirstPayment(first, billable.priceItem.amountCents),
    prepaidSummary: describePrepaid(prepaid),
    prepaidChoice: prepaidChoiceLabel(prepaid.amountCents),
    passChoice: null,
  };
}

async function passRemaining(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  classId: string,
): Promise<{ remaining: number; validUntil: string | null }> {
  const { data } = await supabase
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
  const { data: attendance } = await supabase
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
      validUntil = item.valid_until?.slice(0, 10) ?? null;
    }
  }
  return { remaining, validUntil };
}
