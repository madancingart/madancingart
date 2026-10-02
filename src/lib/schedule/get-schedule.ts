import { addDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { nowInWarsaw, warsawTodayIso, weekDaysFromIso } from "@/lib/datetime";
import type {
  ClassOccupancyRow,
  ClassTypeRow,
  EventRow,
  LocationRow,
  PublicCalendarRow,
  RecurringClassRow,
} from "@/lib/types";
import type {
  ScheduleClass,
  ScheduleData,
  ScheduleEvent,
  ScheduleSlot,
} from "@/lib/schedule/types";

function asList<T>(value: T[] | null): T[] {
  return value ?? [];
}

function occupancyMap(
  rows: ClassOccupancyRow[],
): Map<string, { taken: number; capacity: number }> {
  return new Map(
    rows.map((row) => [
      row.recurring_class_id,
      {
        taken: Number(row.taken),
        capacity: Number(row.capacity),
      },
    ]),
  );
}

export async function getSchedule(): Promise<ScheduleData | null> {
  const supabase = await createClient();
  const from = nowInWarsaw();
  const until = addDays(from, 35);
  const weekStart = weekDaysFromIso(from.toISOString(), 0)[0];
  const cancelledFrom = warsawTodayIso(weekStart);
  const cancelledUntil = warsawTodayIso(addDays(weekStart, 34));

  const [
    classesResult,
    typesResult,
    locationsResult,
    calendarResult,
    occupancyResult,
    eventsResult,
    cancelledResult,
  ] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id,location_id,class_type_id,weekday,start_time,duration_min,level,capacity,signup_open,active,trainer_id",
      )
      .eq("active", true),
    supabase.from("class_types").select("id,slug,name,is_pair,color"),
    supabase.from("locations").select("id,name,address,maps_url"),
    supabase
      .from("public_calendar")
      .select(
        "id,kind,location_id,starts_at,ends_at,status,initial,dance_type,trainer_id",
      )
      .gte("starts_at", from.toISOString())
      .lt("starts_at", until.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("class_occupancy")
      .select("recurring_class_id,taken,capacity"),
    supabase
      .from("events")
      .select(
        "id,location_id,title,description,starts_at,ends_at,capacity,signup_open,published,series_id,session_no,cancelled_at",
      )
      .eq("published", true)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", until.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("public_cancelled_sessions")
      .select("recurring_class_id,session_date")
      .gte("session_date", cancelledFrom)
      .lte("session_date", cancelledUntil),
  ]);

  if (
    classesResult.error ||
    typesResult.error ||
    locationsResult.error ||
    calendarResult.error ||
    occupancyResult.error
  ) {
    return null;
  }

  let eventRowsRaw = asList(eventsResult.data as EventRow[] | null);
  if (eventsResult.error) {
    const fallback = await supabase
      .from("events")
      .select(
        "id,location_id,title,description,starts_at,ends_at,capacity,signup_open,published,series_id,session_no",
      )
      .eq("published", true)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", until.toISOString())
      .order("starts_at", { ascending: true });
    if (fallback.error) {
      return null;
    }
    eventRowsRaw = asList(fallback.data as EventRow[] | null);
  }

  const types = new Map(
    asList(typesResult.data as ClassTypeRow[] | null).map((type) => [
      type.id,
      type,
    ]),
  );
  const occupancy = occupancyMap(
    asList(occupancyResult.data as ClassOccupancyRow[] | null),
  );
  const locationIds = new Set(
    asList(locationsResult.data as LocationRow[] | null).map((row) => row.id),
  );

  const cancelledByClass = new Map<string, string[]>();
  if (!cancelledResult.error) {
    for (const row of asList(
      cancelledResult.data as
        | { recurring_class_id: string; session_date: string }[]
        | null,
    )) {
      const list = cancelledByClass.get(row.recurring_class_id) ?? [];
      list.push(row.session_date);
      cancelledByClass.set(row.recurring_class_id, list);
    }
  }

  const classes: ScheduleClass[] = asList(
    classesResult.data as RecurringClassRow[] | null,
  )
    .filter((row) => row.active && locationIds.has(row.location_id))
    .map((row) => {
      const type = types.get(row.class_type_id);
      const seats = occupancy.get(row.id);
      return {
        id: row.id,
        locationId: row.location_id,
        weekday: row.weekday,
        startTime: row.start_time,
        durationMin: row.duration_min,
        name: type?.name ?? "Zajęcia",
        level: row.level,
        signupOpen: row.signup_open,
        taken: seats?.taken ?? 0,
        capacity: seats?.capacity ?? row.capacity,
        trainerId: row.trainer_id,
        isPair: type?.is_pair ?? false,
        slug: type?.slug ?? "",
        cancelledDates: cancelledByClass.get(row.id) ?? [],
      };
    });

  const slots: ScheduleSlot[] = asList(
    calendarResult.data as PublicCalendarRow[] | null,
  )
    .filter(
      (row) =>
        (row.status === "open" || row.status === "booked") &&
        locationIds.has(row.location_id),
    )
    .map((row) => ({
      id: row.id,
      locationId: row.location_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      initial: row.initial,
      danceType: row.dance_type,
      trainerId: row.trainer_id,
    }));

  const eventRows = eventRowsRaw.filter((row) => row.published);
  const seriesIds = [
    ...new Set(
      eventRows
        .map((row) => row.series_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const sessionTotals = new Map<string, number>();
  if (seriesIds.length > 0) {
    const { data: siblings } = await supabase
      .from("events")
      .select("series_id")
      .in("series_id", seriesIds)
      .eq("published", true);
    for (const row of (siblings ?? []) as { series_id: string | null }[]) {
      if (!row.series_id) {
        continue;
      }
      sessionTotals.set(row.series_id, (sessionTotals.get(row.series_id) ?? 0) + 1);
    }
  }

  const events: ScheduleEvent[] = eventRows.map((row) => {
    const total = row.series_id ? sessionTotals.get(row.series_id) : undefined;
    const cancelled = Boolean(row.cancelled_at);
    return {
      id: row.id,
      locationId: row.location_id,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      signupOpen: row.signup_open && !cancelled,
      sessionLabel: row.session_no && total ? `${row.session_no}/${total}` : null,
      cancelled,
    };
  });

  return { classes, slots, events };
}
