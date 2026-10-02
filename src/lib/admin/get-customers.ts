import "server-only";

import {
  customerDisplayName,
  customerListBilling,
} from "@/lib/admin/customer-label";
import {
  CUSTOMER_PAGE_SIZE,
  customerSearchOrFilter,
} from "@/lib/admin/customer-search";
import { warsawTodayIso } from "@/lib/datetime";
import { isWeddingPackageKind } from "@/content/packages";
import { billingStatus, type BillingStatus } from "@/lib/billing/status";
import type { CustomerKind } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export { CUSTOMER_PAGE_SIZE };

export type CustomerListCard = {
  id: string;
  displayName: string;
  phone: string | null;
  membership: BillingStatus;
  futureCount: number;
  createdAt: string;
};

type CustomerListRow = {
  id: string;
  kind: CustomerKind;
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  guardian_name: string | null;
  phone: string | null;
  created_at: string;
};

type SlotEmbed = { starts_at: string };
type EventEmbed = { starts_at: string };

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getCustomersPage(
  supabase: SupabaseClient,
  input: { q: string; page: number },
): Promise<{ rows: CustomerListCard[]; total: number }> {
  const page = input.page > 0 ? input.page : 1;
  const from = (page - 1) * CUSTOMER_PAGE_SIZE;
  const to = from + CUSTOMER_PAGE_SIZE - 1;
  const orFilter = customerSearchOrFilter(input.q);

  let query = supabase
    .from("customers")
    .select(
      "id,kind,first_name,last_name,partner_first_name,partner_last_name,guardian_name,phone,created_at",
      { count: "exact" },
    );

  if (orFilter) {
    query = query.or(orFilter).order("last_name", { ascending: true }).order(
      "first_name",
      { ascending: true },
    );
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    return { rows: [], total: 0 };
  }

  const customers = (data ?? []) as CustomerListRow[];
  const ids = customers.map((row) => row.id);
  const extras = await loadListExtras(supabase, ids);

  return {
    rows: customers.map((row) => ({
      id: row.id,
      displayName: customerDisplayName({
        kind: row.kind,
        firstName: row.first_name,
        lastName: row.last_name,
        partnerFirstName: row.partner_first_name,
        partnerLastName: row.partner_last_name,
        guardianName: row.guardian_name,
      }),
      phone: row.phone,
      membership: extras.membershipById.get(row.id) ?? {
        tone: "green",
        reason: "clear",
        label: "Bez zaległości",
      },
      futureCount: extras.futureById.get(row.id) ?? 0,
      createdAt: row.created_at,
    })),
    total: count ?? 0,
  };
}

async function loadListExtras(
  supabase: SupabaseClient,
  customerIds: string[],
): Promise<{
  membershipById: Map<string, BillingStatus>;
  futureById: Map<string, number>;
}> {
  const membershipById = new Map<string, BillingStatus>();
  const futureById = new Map<string, number>();
  if (customerIds.length === 0) {
    return { membershipById, futureById };
  }

  const todayIso = warsawTodayIso();
  const nowIso = new Date().toISOString();

  const [{ data: packageRows }, { data: bookingRows }, { data: enrollmentRows }] =
    await Promise.all([
      supabase
        .from("packages")
        .select("customer_id, kind, status")
        .in("customer_id", customerIds),
      supabase
        .from("bookings")
        .select("id,customer_id,kind,status,slots(starts_at),events(starts_at)")
        .in("customer_id", customerIds)
        .neq("status", "cancelled"),
      supabase
        .from("enrollments")
        .select("id, customer_id, status, billing_mode, paid_until, hold_expires_at")
        .in("customer_id", customerIds)
        .in("status", ["pending", "active", "paused"]),
    ]);

  const enrollments = (enrollmentRows ?? []) as {
    id: string;
    customer_id: string;
    status: "pending" | "active" | "paused";
    billing_mode: "monthly" | "pass4" | null;
    paid_until: string | null;
    hold_expires_at: string | null;
  }[];
  const enrollmentIds = enrollments.map((row) => row.id);
  const chargesByEnrollment = new Map<
    string,
    { status: "open" | "paid"; dueDate: string; amountCents: number; periodStart: string | null; periodEnd: string | null }[]
  >();
  if (enrollmentIds.length > 0) {
    const { data: chargeRows } = await supabase
      .from("charges")
      .select("enrollment_id, status, due_date, amount_cents, period_start, period_end")
      .in("enrollment_id", enrollmentIds)
      .neq("status", "void");
    for (const charge of (chargeRows ?? []) as {
      enrollment_id: string;
      status: "open" | "paid";
      due_date: string;
      amount_cents: number;
      period_start: string | null;
      period_end: string | null;
    }[]) {
      const list = chargesByEnrollment.get(charge.enrollment_id) ?? [];
      list.push({
        status: charge.status,
        dueDate: charge.due_date.slice(0, 10),
        amountCents: charge.amount_cents,
        periodStart: charge.period_start?.slice(0, 10) ?? null,
        periodEnd: charge.period_end?.slice(0, 10) ?? null,
      });
      chargesByEnrollment.set(charge.enrollment_id, list);
    }
  }

  const statusesByCustomer = new Map<string, BillingStatus[]>();
  for (const enrollment of enrollments) {
    const status = billingStatus({
      today: todayIso,
      enrollmentStatus: enrollment.status,
      billingMode: enrollment.billing_mode ?? "monthly",
      paidUntil: enrollment.paid_until?.slice(0, 10) ?? null,
      holdExpiresAt: enrollment.hold_expires_at,
      charges: chargesByEnrollment.get(enrollment.id) ?? [],
      pass: null,
    });
    const list = statusesByCustomer.get(enrollment.customer_id) ?? [];
    list.push(status);
    statusesByCustomer.set(enrollment.customer_id, list);
  }

  const weddingByCustomer = new Map<string, { active: boolean; pending: boolean }>();
  for (const pkg of (packageRows ?? []) as { customer_id: string; kind: string; status: string }[]) {
    if (!isWeddingPackageKind(pkg.kind)) {
      continue;
    }
    const current = weddingByCustomer.get(pkg.customer_id) ?? { active: false, pending: false };
    if (pkg.status === "active") {
      current.active = true;
    }
    if (pkg.status === "pending_payment") {
      current.pending = true;
    }
    weddingByCustomer.set(pkg.customer_id, current);
  }

  for (const customerId of customerIds) {
    const wedding = weddingByCustomer.get(customerId);
    membershipById.set(
      customerId,
      customerListBilling({
        statuses: statusesByCustomer.get(customerId) ?? [],
        weddingActive: wedding?.active ?? false,
        weddingPending: wedding?.pending ?? false,
      }),
    );
  }

  for (const row of bookingRows ?? []) {
    const customerId = row.customer_id as string | null;
    if (!customerId || row.kind === "class") {
      continue;
    }
    const slot = asOne(row.slots as SlotEmbed | SlotEmbed[] | null);
    const event = asOne(row.events as EventEmbed | EventEmbed[] | null);
    const startsAt = slot?.starts_at ?? event?.starts_at ?? null;
    if (startsAt && startsAt > nowIso) {
      futureById.set(customerId, (futureById.get(customerId) ?? 0) + 1);
    }
  }

  return { membershipById, futureById };
}
