import "server-only";

import {
  customerDisplayName,
  customerListPaymentStatus,
} from "@/lib/admin/customer-label";
import {
  CUSTOMER_PAGE_SIZE,
  customerSearchOrFilter,
} from "@/lib/admin/customer-search";
import { warsawTodayIso } from "@/lib/datetime";
import { isGroupPassKind } from "@/lib/membership-status";
import type { MembershipStatus } from "@/lib/membership-status";
import type {
  CustomerKind,
  PackageKind,
  PackageStatus,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export { CUSTOMER_PAGE_SIZE };

export type CustomerListCard = {
  id: string;
  displayName: string;
  phone: string | null;
  membership: MembershipStatus;
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

type PackageLite = {
  id: string;
  customer_id: string;
  kind: PackageKind;
  status: PackageStatus;
  valid_from: string | null;
  valid_until: string | null;
  total_lessons: number | null;
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
        level: "unpaid",
        label: "nieopłacone",
        detail: null,
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
  membershipById: Map<string, MembershipStatus>;
  futureById: Map<string, number>;
}> {
  const membershipById = new Map<string, MembershipStatus>();
  const futureById = new Map<string, number>();
  if (customerIds.length === 0) {
    return { membershipById, futureById };
  }

  const todayIso = warsawTodayIso();
  const nowIso = new Date().toISOString();

  const [{ data: packageRows }, { data: bookingRows }] = await Promise.all([
    supabase
      .from("packages")
      .select(
        "id,customer_id,kind,status,valid_from,valid_until,total_lessons",
      )
      .in("customer_id", customerIds),
    supabase
      .from("bookings")
      .select(
        "id,customer_id,kind,status,slots(starts_at),events(starts_at)",
      )
      .in("customer_id", customerIds)
      .neq("status", "cancelled"),
  ]);

  const packages = (packageRows ?? []) as PackageLite[];
  const packageIds = packages
    .filter((pkg) => isGroupPassKind(pkg.kind))
    .map((pkg) => pkg.id);
  const usedByPackageId = new Map<string, number>();
  if (packageIds.length > 0) {
    const { data: attendance } = await supabase
      .from("attendance")
      .select("package_id")
      .in("package_id", packageIds)
      .eq("present", true);
    for (const row of attendance ?? []) {
      const id = row.package_id as string | null;
      if (!id) {
        continue;
      }
      usedByPackageId.set(id, (usedByPackageId.get(id) ?? 0) + 1);
    }
  }

  const packagesByCustomer = new Map<string, PackageLite[]>();
  for (const pkg of packages) {
    const list = packagesByCustomer.get(pkg.customer_id) ?? [];
    list.push(pkg);
    packagesByCustomer.set(pkg.customer_id, list);
  }

  for (const customerId of customerIds) {
    const list = packagesByCustomer.get(customerId) ?? [];
    membershipById.set(
      customerId,
      customerListPaymentStatus(
        list.map((pkg) => ({
          kind: pkg.kind,
          status: pkg.status,
          validFrom: pkg.valid_from,
          validUntil: pkg.valid_until,
          totalLessons: pkg.total_lessons,
          usedEntries: usedByPackageId.get(pkg.id) ?? 0,
        })),
        todayIso,
      ),
    );
  }

  for (const row of bookingRows ?? []) {
    const customerId = row.customer_id as string | null;
    if (!customerId) {
      continue;
    }
    const kind = row.kind as string;
    if (kind === "class") {
      futureById.set(customerId, (futureById.get(customerId) ?? 0) + 1);
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
