import {
  BOOKING_PAGE_SIZE,
  createdAtBounds,
  sanitizeSearch,
  type BookingListFilters,
} from "@/lib/admin/booking-filters";
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
};

const COLUMNS =
  "id,kind,first_name,last_name,phone,email,status,payment_status,created_at,location_id,slot_starts_at,slot_ends_at,event_starts_at,event_ends_at,event_title,class_weekday,class_start_time,class_duration_min,class_name";

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
    rows: (data ?? []).map((row) => mapRow(row)),
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

  return (data ?? []).map((row) => mapRow(row));
}
