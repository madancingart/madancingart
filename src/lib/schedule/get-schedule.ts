import { addDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { nowInWarsaw } from "@/lib/datetime";
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
  const until = addDays(from, 21);

  const [
    classesResult,
    typesResult,
    locationsResult,
    calendarResult,
    occupancyResult,
    eventsResult,
  ] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id,location_id,class_type_id,weekday,start_time,duration_min,level,capacity,signup_open,active",
      )
      .eq("active", true),
    supabase.from("class_types").select("id,slug,name,is_pair,color"),
    supabase.from("locations").select("id,name,address,maps_url"),
    supabase
      .from("public_calendar")
      .select(
        "id,kind,location_id,starts_at,ends_at,status,initial,dance_type",
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
        "id,location_id,title,description,starts_at,ends_at,capacity,signup_open,published",
      )
      .eq("published", true)
      .gte("starts_at", from.toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  if (
    classesResult.error ||
    typesResult.error ||
    locationsResult.error ||
    calendarResult.error ||
    occupancyResult.error ||
    eventsResult.error
  ) {
    return null;
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
    }));

  const events: ScheduleEvent[] = asList(
    eventsResult.data as EventRow[] | null,
  )
    .filter((row) => row.published)
    .map((row) => ({
      id: row.id,
      locationId: row.location_id,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      signupOpen: row.signup_open,
    }));

  return { classes, slots, events };
}
