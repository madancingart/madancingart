import "server-only";

import { billingStatus, type BillingCharge, type BillingStatus } from "@/lib/billing/status";
import type { AdminGroupMember } from "@/lib/admin/calendar-types";
import type { CustomerKind, EnrollmentBillingMode, EnrollmentStatus } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type CustomerEmbed = {
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  kind: CustomerKind;
  partner_first_name: string | null;
  partner_last_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
};

type EnrollmentRow = {
  id: string;
  recurring_class_id: string;
  customer_id: string;
  status: EnrollmentStatus;
  billing_mode: EnrollmentBillingMode | null;
  paid_until: string | null;
  hold_expires_at: string | null;
  customers: CustomerEmbed | CustomerEmbed[] | null;
};

const TONE_RANK: Record<BillingStatus["tone"], number> = {
  red: 0,
  amber: 1,
  pending: 2,
  green: 3,
};

export async function loadClassRosters(
  supabase: SupabaseClient,
  classIds: string[],
  todayIso: string,
): Promise<Map<string, { taken: number; members: AdminGroupMember[] }>> {
  const result = new Map<string, { taken: number; members: AdminGroupMember[] }>();
  for (const classId of classIds) {
    result.set(classId, { taken: 0, members: [] });
  }
  if (classIds.length === 0) {
    return result;
  }

  const { data } = await supabase
    .from("enrollments")
    .select(
      "id, recurring_class_id, customer_id, status, billing_mode, paid_until, hold_expires_at, customers(first_name, last_name, phone, email, kind, partner_first_name, partner_last_name, guardian_name, guardian_phone)",
    )
    .in("recurring_class_id", classIds)
    .in("status", ["pending", "active", "paused"]);

  const rows = (data ?? []) as EnrollmentRow[];
  const ids = rows.map((row) => row.id);
  const chargesByEnrollment = new Map<string, BillingCharge[]>();
  if (ids.length > 0) {
    const { data: chargeRows } = await supabase
      .from("charges")
      .select("enrollment_id, status, due_date, amount_cents, period_start, period_end")
      .in("enrollment_id", ids)
      .neq("status", "void");
    for (const charge of (chargeRows ?? []) as {
      enrollment_id: string;
      status: "open" | "paid" | "void";
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

  for (const row of rows) {
    const bucket = result.get(row.recurring_class_id);
    if (!bucket) {
      continue;
    }
    bucket.taken += 1;
    if (row.status !== "active" && row.status !== "paused") {
      continue;
    }
    const customer = one(row.customers);
    if (!customer) {
      continue;
    }
    const billing = billingStatus({
      today: todayIso,
      enrollmentStatus: row.status,
      billingMode: row.billing_mode ?? "monthly",
      paidUntil: row.paid_until?.slice(0, 10) ?? null,
      holdExpiresAt: row.hold_expires_at,
      charges: chargesByEnrollment.get(row.id) ?? [],
      pass: null,
    });
    bucket.members.push({
      key: row.id,
      enrollmentId: row.id,
      customerId: row.customer_id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      email: customer.email,
      customerKind: customer.kind,
      partnerFirstName: customer.partner_first_name,
      partnerLastName: customer.partner_last_name,
      guardianName: customer.guardian_name,
      guardianPhone: customer.guardian_phone,
      enrollmentStatus: row.status,
      paidUntil: row.paid_until?.slice(0, 10) ?? null,
      billing,
    });
  }

  for (const bucket of result.values()) {
    bucket.members.sort((left, right) => {
      const tone = TONE_RANK[left.billing.tone] - TONE_RANK[right.billing.tone];
      if (tone !== 0) {
        return tone;
      }
      return `${left.lastName ?? ""} ${left.firstName}`.localeCompare(
        `${right.lastName ?? ""} ${right.firstName}`,
        "pl",
      );
    });
  }
  return result;
}

function one<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
