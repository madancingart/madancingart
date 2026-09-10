import { addMinutes, getISODay, isSameDay } from "date-fns";
import { site, type LocationId } from "@/content/site";
import { isUnconfirmedUrgent } from "@/lib/booking/confirmation-window";
import {
  boundsOfWarsawDay,
  classStartOnDay,
  formatBookingWhen,
  formatTimeRange,
  nowInWarsaw,
  toWarsaw,
} from "@/lib/datetime";
import type { BookingKind, BookingStatus, SlotStatus } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TodayItem = {
  id: string;
  kind: "class" | "slot" | "event";
  title: string;
  locationId: string;
  locationLabel: string;
  time: string;
  detail: string | null;
  sortKey: number;
};

export type AwaitingConfirmation = {
  id: string;
  name: string;
  phone: string | null;
  when: string;
  locationLabel: string;
  startsAt: string;
  customerId: string | null;
};

export type PendingBooking = {
  id: string;
  name: string;
  kind: BookingKind;
  createdAt: string;
  status: BookingStatus;
  customerId: string | null;
};

function city(locationId: string): string {
  return site.locations.find((item) => item.id === locationId)?.city ?? locationId;
}

function filterLocation(
  locationId: string | null,
  selected: LocationId | "all",
): boolean {
  if (selected === "all") {
    return true;
  }
  if (locationId === null) {
    return true;
  }
  return locationId === selected;
}

export async function getAdminDashboard(
  supabase: SupabaseClient,
  selected: LocationId | "all",
): Promise<{
  today: TodayItem[];
  todayCount: number;
  pending: PendingBooking[];
  pendingCount: number;
  awaitingConfirmation: AwaitingConfirmation[];
}> {
  const now = nowInWarsaw();
  const { start, end } = boundsOfWarsawDay(now);
  const weekday = getISODay(now);

  const [
    classesResult,
    typesResult,
    slotsResult,
    eventsResult,
    pendingResult,
    pendingCountResult,
    awaitingSlotsResult,
  ] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id,location_id,class_type_id,weekday,start_time,duration_min,level,active",
      )
      .eq("active", true)
      .eq("weekday", weekday),
    supabase.from("class_types").select("id,name"),
    supabase
      .from("slots")
      .select("id,location_id,starts_at,ends_at,status")
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("events")
      .select("id,location_id,title,starts_at,ends_at")
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("admin_booking_list")
      .select("id,first_name,last_name,kind,created_at,status,location_id,customer_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("admin_booking_list")
      .select("id,location_id", { count: "exact" })
      .eq("status", "pending"),
    supabase
      .from("slots")
      .select("id,location_id,starts_at,ends_at")
      .eq("status", "booked")
      .gt("starts_at", now.toISOString())
      .lte("starts_at", new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const types = new Map(
    (typesResult.data ?? []).map((row) => [row.id as string, row.name as string]),
  );

  const today: TodayItem[] = [];

  for (const row of classesResult.data ?? []) {
    const locationId = row.location_id as string;
    if (!filterLocation(locationId, selected)) {
      continue;
    }
    const startAt = classStartOnDay(now, row.start_time as string);
    const endAt = addMinutes(startAt, Number(row.duration_min));
    today.push({
      id: `class-${row.id}`,
      kind: "class",
      title: types.get(row.class_type_id as string) ?? "Zajęcia",
      locationId,
      locationLabel: city(locationId),
      time: formatTimeRange(startAt, endAt),
      detail: (row.level as string | null) ?? null,
      sortKey: startAt.getHours() * 60 + startAt.getMinutes(),
    });
  }

  for (const row of slotsResult.data ?? []) {
    const locationId = row.location_id as string;
    if (!filterLocation(locationId, selected)) {
      continue;
    }
    const starts = toWarsaw(row.starts_at as string);
    if (!isSameDay(starts, now)) {
      continue;
    }
    const ends = toWarsaw(row.ends_at as string);
    const status = row.status as SlotStatus;
    today.push({
      id: `slot-${row.id}`,
      kind: "slot",
      title: "Termin indywidualny",
      locationId,
      locationLabel: city(locationId),
      time: formatTimeRange(starts, ends),
      detail:
        status === "open"
          ? "wolny"
          : status === "booked"
            ? "zajęty"
            : "zablokowany",
      sortKey: starts.getHours() * 60 + starts.getMinutes(),
    });
  }

  for (const row of eventsResult.data ?? []) {
    const locationId = row.location_id as string | null;
    if (!filterLocation(locationId, selected)) {
      continue;
    }
    const starts = toWarsaw(row.starts_at as string);
    const ends = toWarsaw(row.ends_at as string);
    today.push({
      id: `event-${row.id}`,
      kind: "event",
      title: row.title as string,
      locationId: locationId ?? "",
      locationLabel: locationId ? city(locationId) : "obie sale",
      time: formatTimeRange(starts, ends),
      detail: "wydarzenie",
      sortKey: starts.getHours() * 60 + starts.getMinutes(),
    });
  }

  today.sort((a, b) => a.sortKey - b.sortKey);

  const pendingFiltered = (pendingResult.data ?? []).filter((row) =>
    filterLocation((row.location_id as string | null) ?? null, selected),
  );

  const pending: PendingBooking[] = pendingFiltered.slice(0, 8).map((row) => ({
    id: row.id as string,
    name: `${row.first_name as string} ${row.last_name as string | null ?? ""}`.trim(),
    kind: row.kind as BookingKind,
    createdAt: row.created_at as string,
    status: row.status as BookingStatus,
    customerId: (row.customer_id as string | null) ?? null,
  }));

  const pendingCount = (pendingCountResult.data ?? []).filter((row) =>
    filterLocation((row.location_id as string | null) ?? null, selected),
  ).length;

  const awaitingSlotIds = (awaitingSlotsResult.data ?? [])
    .filter((row) => filterLocation(row.location_id as string, selected))
    .filter((row) =>
      isUnconfirmedUrgent(toWarsaw(row.starts_at as string), now),
    )
    .map((row) => row.id as string);

  let awaitingConfirmation: AwaitingConfirmation[] = [];
  if (awaitingSlotIds.length > 0) {
    const { data: awaitingBookings } = await supabase
      .from("bookings")
      .select(
        "id,first_name,last_name,phone,status,confirmed_at,slot_id,customer_id,customers(guardian_phone)",
      )
      .eq("kind", "slot")
      .neq("status", "cancelled")
      .is("confirmed_at", null)
      .in("slot_id", awaitingSlotIds);

    const slotById = new Map(
      (awaitingSlotsResult.data ?? []).map((row) => [row.id as string, row]),
    );

    type GuardianEmbed = { guardian_phone: string | null };
    awaitingConfirmation = (awaitingBookings ?? [])
      .map((row) => {
        const slot = slotById.get(row.slot_id as string);
        if (!slot) {
          return null;
        }
        const starts = toWarsaw(slot.starts_at as string);
        const ends = toWarsaw(slot.ends_at as string);
        const embed = row.customers as GuardianEmbed | GuardianEmbed[] | null;
        const guardian = Array.isArray(embed) ? embed[0] : embed;
        const phone =
          (guardian?.guardian_phone as string | null) ??
          ((row.phone as string | null) ?? null);
        return {
          id: row.id as string,
          name: `${row.first_name as string} ${row.last_name as string | null ?? ""}`.trim(),
          phone,
          when: formatBookingWhen(starts, ends),
          locationLabel: city(slot.location_id as string),
          startsAt: slot.starts_at as string,
          customerId: (row.customer_id as string | null) ?? null,
        };
      })
      .filter((item): item is AwaitingConfirmation => item !== null)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  }

  return {
    today,
    todayCount: today.length,
    pending,
    pendingCount,
    awaitingConfirmation,
  };
}
