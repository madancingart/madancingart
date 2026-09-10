import {
  BOOKING_PAGE_SIZE,
  createdAtBounds,
  sanitizeSearch,
  type BookingListFilters,
} from "@/lib/admin/booking-filters";
import { loadGroupPassData } from "@/lib/admin/load-group-passes";
import { warsawTodayIso } from "@/lib/datetime";
import {
  membershipStatus,
  type MembershipStatus,
} from "@/lib/membership-status";
import type { BookingKind, BookingStatus, PaymentStatus } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminBookingListRow = {
  id: string;
  kind: BookingKind;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  locationId: string | null;
  slotStartsAt: string | null;
  slotEndsAt: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  eventTitle: string | null;
  classWeekday: number | null;
  classStartTime: string | null;
  classDurationMin: number | null;
  className: string | null;
  recurringClassId: string | null;
  customerId: string | null;
  membership: MembershipStatus | null;
};

const COLUMNS =
  "id,kind,first_name,last_name,phone,email,status,payment_status,created_at,location_id,slot_starts_at,slot_ends_at,event_starts_at,event_ends_at,event_title,class_weekday,class_start_time,class_duration_min,class_name,recurring_class_id,customer_id";

type BookingListResult = Promise<{
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
  count: number | null;
}>;

type BookingListQuery = {
  eq: (column: string, value: string) => BookingListQuery;
  or: (filters: string) => BookingListQuery;
  gte: (column: string, value: string) => BookingListQuery;
  lte: (column: string, value: string) => BookingListQuery;
  range: (from: number, to: number) => BookingListQuery;
  limit: (count: number) => BookingListQuery;
};

function mapRow(row: Record<string, unknown>): AdminBookingListRow {
  return {
    id: row.id as string,
    kind: row.kind as BookingKind,
    firstName: row.first_name as string,
    lastName: (row.last_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    status: row.status as BookingStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    createdAt: row.created_at as string,
    locationId: (row.location_id as string | null) ?? null,
    slotStartsAt: (row.slot_starts_at as string | null) ?? null,
    slotEndsAt: (row.slot_ends_at as string | null) ?? null,
    eventStartsAt: (row.event_starts_at as string | null) ?? null,
    eventEndsAt: (row.event_ends_at as string | null) ?? null,
    eventTitle: (row.event_title as string | null) ?? null,
    classWeekday: (row.class_weekday as number | null) ?? null,
    classStartTime: (row.class_start_time as string | null) ?? null,
    classDurationMin: (row.class_duration_min as number | null) ?? null,
    className: (row.class_name as string | null) ?? null,
    recurringClassId: (row.recurring_class_id as string | null) ?? null,
    customerId: (row.customer_id as string | null) ?? null,
    membership: null,
  };
}

function applyFilters(
  query: BookingListQuery,
  filters: BookingListFilters,
): BookingListQuery {
  let next = query;
  if (filters.status) {
    next = next.eq("status", filters.status);
  }
  if (filters.kind) {
    next = next.eq("kind", filters.kind);
  }
  if (filters.locationId) {
    next = next.or(
      `location_id.eq.${filters.locationId},location_id.is.null`,
    );
  }
  const bounds = createdAtBounds(filters.from, filters.to);
  if (bounds.gte) {
    next = next.gte("created_at", bounds.gte);
  }
  if (bounds.lte) {
    next = next.lte("created_at", bounds.lte);
  }
  const q = filters.q ? sanitizeSearch(filters.q) : "";
  if (q.length > 0) {
    next = next.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  }
  return next;
}

function startListQuery(
  supabase: SupabaseClient,
  withCount: boolean,
): BookingListQuery {
  const select = withCount
    ? supabase
        .from("admin_booking_list")
        .select(COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false })
    : supabase
        .from("admin_booking_list")
        .select(COLUMNS)
        .order("created_at", { ascending: false });

  return select as unknown as BookingListQuery;
}

async function attachMembership(
  supabase: SupabaseClient,
  rows: AdminBookingListRow[],
): Promise<AdminBookingListRow[]> {
  const classRows = rows.filter(
    (row) => row.kind === "class" && row.status !== "cancelled",
  );
  if (classRows.length === 0) {
    return rows;
  }

  const ids = classRows.map((row) => row.id);
  const { data: extras } = await supabase
    .from("bookings")
    .select("id,customer_id")
    .in("id", ids);

  const customerByBooking = new Map<string, string | null>();
  for (const extra of extras ?? []) {
    customerByBooking.set(
      extra.id as string,
      (extra.customer_id as string | null) ?? null,
    );
  }

  const customerIds = [...customerByBooking.values()].filter(
    (id): id is string => Boolean(id),
  );
  const { packages, usedByPackageId } = await loadGroupPassData(
    supabase,
    customerIds,
  );
  const todayIso = warsawTodayIso();

  return rows.map((row) => {
    if (row.kind !== "class" || row.status === "cancelled") {
      return row;
    }
    const customerId = customerByBooking.get(row.id) ?? row.customerId;
    const classPackages = packages.filter(
      (pkg) =>
        pkg.customer_id === customerId &&
        pkg.recurring_class_id === row.recurringClassId,
    );
    return {
      ...row,
      customerId,
      membership: membershipStatus(
        classPackages.map((pkg) => ({
          kind: pkg.kind,
          status: pkg.status,
          validFrom: pkg.valid_from,
          validUntil: pkg.valid_until,
          totalLessons: pkg.total_lessons,
          usedEntries: usedByPackageId.get(pkg.id) ?? 0,
        })),
        todayIso,
      ),
    };
  });
}

export async function getAdminBookingsPage(
  supabase: SupabaseClient,
  filters: BookingListFilters,
): Promise<{ rows: AdminBookingListRow[]; total: number }> {
  const from = (filters.page - 1) * BOOKING_PAGE_SIZE;
  const to = from + BOOKING_PAGE_SIZE - 1;

  const { data, count, error } = await (applyFilters(
    startListQuery(supabase, true),
    filters,
  ).range(from, to) as unknown as BookingListResult);

  if (error) {
    return { rows: [], total: 0 };
  }

  return {
    rows: await attachMembership(
      supabase,
      (data ?? []).map((row) => mapRow(row)),
    ),
    total: count ?? 0,
  };
}

export async function getAdminBookingsExport(
  supabase: SupabaseClient,
  filters: BookingListFilters,
): Promise<AdminBookingListRow[]> {
  const { data, error } = await (applyFilters(
    startListQuery(supabase, false),
    filters,
  ).limit(5000) as unknown as BookingListResult);

  if (error) {
    return [];
  }

  return attachMembership(
    supabase,
    (data ?? []).map((row) => mapRow(row)),
  );
}
