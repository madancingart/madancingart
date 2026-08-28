import { boundsOfWarsawDay, weekDaysFromIso } from "@/lib/datetime";
import type {
  AdminBooking,
  AdminCalendarData,
  AdminClass,
  AdminSlot,
} from "@/lib/admin/calendar-types";
import type {
  BookingRow,
  ClassTypeRow,
  RecurringClassRow,
  SlotRow,
} from "@/lib/types";
import type { LocationId } from "@/content/site";
import type { SupabaseClient } from "@supabase/supabase-js";

function asList<T>(value: T[] | null): T[] {
  return value ?? [];
}

function toBooking(row: BookingRow): AdminBooking {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    danceType: row.dance_type,
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    slotId: row.slot_id,
    recurringClassId: row.recurring_class_id,
  };
}

function isActive(status: BookingRow["status"]): boolean {
  return status !== "cancelled";
}

export async function getAdminCalendar(
  supabase: SupabaseClient,
  locationId: LocationId,
  nowIso: string,
  weekOffset: number,
): Promise<AdminCalendarData> {
  const days = weekDaysFromIso(nowIso, weekOffset);
  const from = boundsOfWarsawDay(days[0]).start;
  const until = boundsOfWarsawDay(days[6]).end;

  const [classesResult, typesResult, slotsResult] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id,location_id,class_type_id,weekday,start_time,duration_min,level,capacity,signup_open,active",
      )
      .eq("active", true)
      .eq("location_id", locationId),
    supabase.from("class_types").select("id,slug,name,is_pair,color"),
    supabase
      .from("slots")
      .select("id,location_id,starts_at,ends_at,status,admin_note,created_at")
      .eq("location_id", locationId)
      .gte("starts_at", from.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const classRows = asList(classesResult.data as RecurringClassRow[] | null);
  const slotRows = asList(slotsResult.data as SlotRow[] | null);
  const types = new Map(
    asList(typesResult.data as ClassTypeRow[] | null).map((type) => [
      type.id,
      type,
    ]),
  );

  const classIds = classRows.map((row) => row.id);
  const slotIds = slotRows.map((row) => row.id);

  let bookingRows: BookingRow[] = [];
  if (classIds.length > 0 || slotIds.length > 0) {
    const filters: string[] = [];
    if (classIds.length > 0) {
      filters.push(`recurring_class_id.in.(${classIds.join(",")})`);
    }
    if (slotIds.length > 0) {
      filters.push(`slot_id.in.(${slotIds.join(",")})`);
    }

    const bookingsResult = await supabase
      .from("bookings")
      .select(
        "id,kind,slot_id,recurring_class_id,event_id,first_name,last_name,phone,email,message,dance_type,status,payment_option,payment_status,stripe_checkout_session_id,amount_cents,consent_rodo,created_at",
      )
      .or(filters.join(","))
      .order("created_at", { ascending: true });

    bookingRows = asList(bookingsResult.data as BookingRow[] | null);
  }

  const bookingsByClass = new Map<string, AdminBooking[]>();
  const bookingBySlot = new Map<string, AdminBooking>();

  for (const row of bookingRows) {
    const booking = toBooking(row);
    if (row.recurring_class_id) {
      const list = bookingsByClass.get(row.recurring_class_id) ?? [];
      list.push(booking);
      bookingsByClass.set(row.recurring_class_id, list);
    }
    if (row.slot_id && isActive(row.status)) {
      bookingBySlot.set(row.slot_id, booking);
    }
  }

  const classes: AdminClass[] = classRows.map((row) => {
    const all = bookingsByClass.get(row.id) ?? [];
    const active = all.filter((item) => isActive(item.status));
    return {
      id: row.id,
      locationId: row.location_id,
      weekday: row.weekday,
      startTime: row.start_time,
      durationMin: row.duration_min,
      name: types.get(row.class_type_id)?.name ?? "Zajęcia",
      level: row.level,
      signupOpen: row.signup_open,
      taken: active.length,
      capacity: row.capacity,
      bookings: all,
    };
  });

  const slots: AdminSlot[] = slotRows.map((row) => ({
    id: row.id,
    locationId: row.location_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    adminNote: row.admin_note,
    booking: bookingBySlot.get(row.id) ?? null,
  }));

  return { classes, slots };
}
