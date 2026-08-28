import { addMinutes, getISODay, isSameDay } from "date-fns";
import { site, type LocationId } from "@/content/site";
import {
  boundsOfWarsawDay,
  classStartOnDay,
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

export type PendingBooking = {
  id: string;
  name: string;
  kind: BookingKind;
  createdAt: string;
  status: BookingStatus;
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
  pending: PendingBooking[];
  pendingCount: number;
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
      .from("bookings")
      .select("id,first_name,last_name,kind,created_at,status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
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

  const pending: PendingBooking[] = (pendingResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: `${row.first_name as string} ${row.last_name as string}`,
    kind: row.kind as BookingKind,
    createdAt: row.created_at as string,
    status: row.status as BookingStatus,
  }));

  return {
    today,
    pending,
    pendingCount: pendingCountResult.count ?? pending.length,
  };
}
