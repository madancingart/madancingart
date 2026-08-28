import { boundsOfWarsawDay, fromDatetimeLocal } from "@/lib/datetime";
import type { BookingKind, BookingStatus } from "@/lib/types";
import type { LocationId } from "@/content/site";

export const BOOKING_PAGE_SIZE = 25;

export type BookingListFilters = {
  locationId?: LocationId;
  status?: BookingStatus;
  kind?: BookingKind;
  from?: string;
  to?: string;
  q?: string;
  page: number;
};

export function parseBookingFilters(
  params: Record<string, string | undefined>,
): BookingListFilters {
  const locationId =
    params.lokalizacja === "mikolow" || params.lokalizacja === "lubliniec"
      ? params.lokalizacja
      : undefined;
  const status =
    params.status === "pending" ||
    params.status === "confirmed" ||
    params.status === "cancelled"
      ? params.status
      : undefined;
  const kind =
    params.rodzaj === "slot" ||
    params.rodzaj === "class" ||
    params.rodzaj === "event"
      ? params.rodzaj
      : undefined;
  const from = params.od?.match(/^\d{4}-\d{2}-\d{2}$/) ? params.od : undefined;
  const to = params.do?.match(/^\d{4}-\d{2}-\d{2}$/) ? params.do : undefined;
  const q = params.q?.trim().slice(0, 80) || undefined;
  const pageRaw = Number.parseInt(params.strona ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return { locationId, status, kind, from, to, q, page };
}

export function bookingFiltersToSearchParams(
  filters: BookingListFilters,
  includePage: boolean,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.locationId) {
    params.set("lokalizacja", filters.locationId);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.kind) {
    params.set("rodzaj", filters.kind);
  }
  if (filters.from) {
    params.set("od", filters.from);
  }
  if (filters.to) {
    params.set("do", filters.to);
  }
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (includePage && filters.page > 1) {
    params.set("strona", String(filters.page));
  }
  return params;
}

export function sanitizeSearch(q: string): string {
  return q.replaceAll(/[%*,()]/g, "").trim();
}

export function createdAtBounds(from?: string, to?: string): {
  gte?: string;
  lte?: string;
} {
  const result: { gte?: string; lte?: string } = {};
  if (from) {
    result.gte = boundsOfWarsawDay(fromDatetimeLocal(`${from}T00:00`)).start.toISOString();
  }
  if (to) {
    result.lte = boundsOfWarsawDay(fromDatetimeLocal(`${to}T00:00`)).end.toISOString();
  }
  return result;
}
