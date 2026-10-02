import "server-only";

import { chargesWithOlder, type CheckoutCharge } from "@/lib/billing/charge-set";
import { formatBillingZloty } from "@/lib/billing/status";
import { formatDayMonth } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";

export type PayLinkView = {
  firstName: string;
  lastInitial: string;
  description: string;
  period: string;
  amountLabel: string;
  dueLabel: string;
  status: "open" | "paid" | "void";
  payLabel: string | null;
  bundledNote: string | null;
};

type ChargeRow = {
  id: string;
  customer_id: string;
  enrollment_id: string | null;
  status: "open" | "paid" | "void";
  amount_cents: number;
  label: string;
  period_start: string | null;
  period_end: string | null;
  due_date: string;
  stripe_checkout_session_id: string | null;
  customers: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

export async function loadPayLink(token: string): Promise<PayLinkView | "missing"> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("charges")
    .select(
      "id, customer_id, enrollment_id, status, amount_cents, label, period_start, period_end, due_date, stripe_checkout_session_id, customers(first_name, last_name)",
    )
    .eq("pay_token", token)
    .maybeSingle();

  const row = data as ChargeRow | null;
  if (!row) {
    return "missing";
  }

  const person = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  const lastName = person?.last_name?.trim() ?? "";
  const view: PayLinkView = {
    firstName: person?.first_name?.trim() || "Uczestnik",
    lastInitial: lastName ? `${lastName.slice(0, 1).toLocaleUpperCase("pl")}.` : "",
    description: row.label,
    period: periodLabel(row.period_start, row.period_end),
    amountLabel: formatBillingZloty(row.amount_cents),
    dueLabel: dueLabel(row.due_date),
    status: row.status,
    payLabel: null,
    bundledNote: null,
  };

  if (row.status !== "open") {
    return view;
  }

  const bundle = await olderOpenCharges(row);
  const sum = bundle.reduce((total, charge) => total + charge.amountCents, 0);
  view.payLabel = `Zapłać ${formatBillingZloty(sum || row.amount_cents)}`;
  if (bundle.length > 1) {
    view.bundledNote = "Razem ze starszymi należnościami tego zapisu.";
  }
  return view;
}

export async function checkoutIdsForToken(token: string): Promise<string[] | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("charges")
    .select(
      "id, customer_id, enrollment_id, status, amount_cents, label, period_start, stripe_checkout_session_id",
    )
    .eq("pay_token", token)
    .maybeSingle();
  const row = data as ChargeRow | null;
  if (!row || row.status !== "open") {
    return null;
  }
  return (await olderOpenCharges(row)).map((charge) => charge.id);
}

export async function checkoutIdsForOwnedCharge(
  chargeId: string,
  customerIds: readonly string[],
): Promise<string[] | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("charges")
    .select(
      "id, customer_id, enrollment_id, status, amount_cents, label, period_start, stripe_checkout_session_id",
    )
    .eq("id", chargeId)
    .maybeSingle();
  const row = data as ChargeRow | null;
  if (!row || row.status !== "open" || !customerIds.includes(row.customer_id)) {
    return null;
  }
  return (await olderOpenCharges(row)).map((charge) => charge.id);
}

async function olderOpenCharges(row: ChargeRow): Promise<CheckoutCharge[]> {
  if (!row.enrollment_id) {
    return [
      {
        id: row.id,
        status: row.status,
        periodStart: row.period_start?.slice(0, 10) ?? null,
        customerId: row.customer_id,
        amountCents: row.amount_cents,
        label: row.label,
        enrollmentId: row.enrollment_id,
        stripeSessionId: row.stripe_checkout_session_id,
      },
    ];
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("charges")
    .select(
      "id, customer_id, enrollment_id, status, amount_cents, label, period_start, stripe_checkout_session_id",
    )
    .eq("enrollment_id", row.enrollment_id)
    .eq("status", "open");

  const charges = ((data ?? []) as ChargeRow[]).map((item) => ({
    id: item.id,
    status: item.status,
    periodStart: item.period_start?.slice(0, 10) ?? null,
    customerId: item.customer_id,
    amountCents: item.amount_cents,
    label: item.label,
    enrollmentId: item.enrollment_id,
    stripeSessionId: item.stripe_checkout_session_id,
  }));
  const selected = chargesWithOlder(charges, row.id);
  return selected.length > 0 ? selected : charges.filter((item) => item.id === row.id);
}

function periodLabel(start: string | null, end: string | null): string {
  if (start && end) {
    return `${formatDayMonth(start.slice(0, 10))}–${formatDayMonth(end.slice(0, 10))}`;
  }
  return "Karnet";
}

function dueLabel(isoDate: string): string {
  const day = Number.parseInt(isoDate.slice(8, 10), 10);
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  return `${day}.${month}.${isoDate.slice(0, 4)}`;
}
