import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildIcsCalendar,
  cancelledSessionUtc,
  classOccurrenceUtc,
  classRrule,
  feedWindow,
  locationLine,
  personLabel,
  slotSummary,
  trainerLine,
  type IcsEvent,
} from "@/lib/calendar/ics";
import { nowInWarsaw, warsawTodayIso } from "@/lib/datetime";
import type { EventRow, SlotRow, TrainerRow } from "@/lib/types";

type ClassTypeLite = { id: string; name: string };
type RecurringLite = {
  id: string;
  location_id: string;
  class_type_id: string;
  weekday: number;
  start_time: string;
  duration_min: number;
  level: string | null;
  trainer_id: string | null;
};

type ClassTypeLite = { id: string; name: string };
type SlotBookingLite = {
  slot_id: string;
  first_name: string;
  last_name: string | null;
  dance_type: string | null;
  status: string;
};

function asList<T>(value: T[] | null): T[] {
  return value ?? [];
}

export async function buildSchoolCalendarIcs(): Promise<string> {
  const supabase = createAdminClient();
  const stamp = nowInWarsaw();
  const { from, until } = feedWindow(stamp);

  const [
    classesResult,
    typesResult,
    slotsResult,
    eventsResult,
    trainersResult,
    cancelledResult,
  ] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id,location_id,class_type_id,weekday,start_time,duration_min,level,active,trainer_id",
      )
      .eq("active", true),
    supabase.from("class_types").select("id,name"),
    supabase
      .from("slots")
      .select("id,location_id,starts_at,ends_at,status,admin_note,trainer_id")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", until.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("events")
      .select("id,location_id,title,description,starts_at,ends_at,published")
      .eq("published", true)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", until.toISOString()),
    supabase.from("trainers").select("id,name,active"),
    supabase
      .from("class_sessions")
      .select("recurring_class_id,session_date")
      .eq("status", "cancelled")
      .gte("session_date", warsawTodayIso(from))
      .lte("session_date", warsawTodayIso(until)),
  ]);

  const classRows = asList(classesResult.data as RecurringLite[] | null);
  const slotRows = asList(slotsResult.data as SlotRow[] | null);
  const types = new Map(
    asList(typesResult.data as ClassTypeLite[] | null).map((type) => [
      type.id,
      type.name,
    ]),
  );
  const trainers = new Map(
    asList(trainersResult.data as TrainerRow[] | null).map((row) => [
      row.id,
      row.name,
    ]),
  );

  const slotIds = slotRows.map((row) => row.id);
  let bookings: SlotBookingLite[] = [];
  if (slotIds.length > 0) {
    const bookingsResult = await supabase
      .from("bookings")
      .select("slot_id,first_name,last_name,dance_type,status")
      .in("slot_id", slotIds)
      .neq("status", "cancelled");
    bookings = asList(bookingsResult.data as SlotBookingLite[] | null);
  }
  const bookingBySlot = new Map(
    bookings
      .filter((row) => row.slot_id)
      .map((row) => [row.slot_id, row]),
  );

  const cancelledByClass = new Map<string, string[]>();
  for (const row of asList(
    cancelledResult.data as
      | { recurring_class_id: string; session_date: string }[]
      | null,
  )) {
    const list = cancelledByClass.get(row.recurring_class_id) ?? [];
    list.push(row.session_date);
    cancelledByClass.set(row.recurring_class_id, list);
  }

  const events: IcsEvent[] = [];

  for (const row of classRows) {
    const name = types.get(row.class_type_id) ?? "Zajęcia";
    const { start, end } = classOccurrenceUtc(
      row.weekday,
      row.start_time,
      row.duration_min,
      stamp,
    );
    const trainer =
      trainerLine(row.trainer_id) ||
      (row.trainer_id ? `Trener: ${trainers.get(row.trainer_id) ?? ""}` : "");
    const details = [row.level, trainer].filter(Boolean).join(" · ");
    events.push({
      uid: `class-${row.id}@madancing.art`,
      start,
      end,
      summary: name,
      location: locationLine(row.location_id),
      description: details || undefined,
      rrule: classRrule(row.weekday, until),
      exdates: (cancelledByClass.get(row.id) ?? []).map((date) =>
        cancelledSessionUtc(date, row.start_time),
      ),
    });
  }

  for (const row of slotRows) {
    const booking = bookingBySlot.get(row.id) ?? null;
    const name = booking
      ? personLabel(booking.first_name, booking.last_name)
      : null;
    const extra = [
      trainerLine(row.trainer_id),
      row.admin_note,
    ].filter(Boolean);
    events.push({
      uid: `slot-${row.id}@madancing.art`,
      start: new Date(row.starts_at),
      end: new Date(row.ends_at),
      summary: slotSummary(row.status, name, booking?.dance_type ?? null),
      location: locationLine(row.location_id),
      description: extra.length > 0 ? extra.join(" · ") : undefined,
    });
  }

  for (const row of asList(eventsResult.data as EventRow[] | null)) {
    events.push({
      uid: `event-${row.id}@madancing.art`,
      start: new Date(row.starts_at),
      end: new Date(row.ends_at),
      summary: row.title,
      location: locationLine(row.location_id),
      description: row.description ?? undefined,
    });
  }

  return buildIcsCalendar(events, stamp);
}
