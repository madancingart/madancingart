import { boundsOfWarsawDay, warsawTodayIso, weekDaysFromIso } from "@/lib/datetime";
import type {
  AdminBooking,
  AdminCalendarData,
  AdminClass,
  AdminSlot,
} from "@/lib/admin/calendar-types";
import { buildGroupMembers } from "@/lib/admin/group-members";
import { loadGroupPassData } from "@/lib/admin/load-group-passes";
import type {
  BookingRow,
  ClassTypeRow,
  CustomerKind,
  PackageKind,
  PackageStatus,
  RecurringClassRow,
  SlotRow,
  TrainerRow,
} from "@/lib/types";
import { sortTrainers } from "@/lib/trainers";
import type { LocationId } from "@/content/site";
import type { SupabaseClient } from "@supabase/supabase-js";

function asList<T>(value: T[] | null): T[] {
  return value ?? [];
}

type CustomerEmbed = {
  kind: CustomerKind;
  partner_first_name: string | null;
  partner_last_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
};

type PackageEmbed = {
  id: string;
  kind: PackageKind;
  label: string;
  total_lessons: number | null;
  wedding_date: string | null;
  songs: string[] | null;
  status: PackageStatus;
};

type BookingWithCustomer = BookingRow & {
  customer_id: string | null;
  package_id: string | null;
  lesson_no: number | null;
  customers: CustomerEmbed | CustomerEmbed[] | null;
  packages: PackageEmbed | PackageEmbed[] | null;
};

function customerFromEmbed(
  value: CustomerEmbed | CustomerEmbed[] | null,
): CustomerEmbed | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function packageFromEmbed(
  value: PackageEmbed | PackageEmbed[] | null,
): PackageEmbed | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function toBooking(row: BookingWithCustomer): AdminBooking {
  const customer = customerFromEmbed(row.customers);
  const pkg = packageFromEmbed(row.packages);
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
    customerId: row.customer_id,
    customerKind: customer?.kind ?? null,
    partnerFirstName: customer?.partner_first_name ?? null,
    partnerLastName: customer?.partner_last_name ?? null,
    guardianName: customer?.guardian_name ?? null,
    guardianPhone: customer?.guardian_phone ?? null,
    packageId: row.package_id,
    lessonNo: row.lesson_no,
    confirmedAt: row.confirmed_at,
    weddingPackage: pkg
      ? {
          id: pkg.id,
          kind: pkg.kind,
          label: pkg.label,
          totalLessons: pkg.total_lessons,
          weddingDate: pkg.wedding_date,
          songs: pkg.songs,
          status: pkg.status,
        }
      : null,
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

  const [classesResult, typesResult, slotsResult, trainersResult] =
    await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id,location_id,class_type_id,weekday,start_time,duration_min,level,capacity,signup_open,active,trainer_id",
      )
      .eq("active", true)
      .eq("location_id", locationId),
    supabase.from("class_types").select("id,slug,name,is_pair,color"),
    supabase
      .from("slots")
      .select(
        "id,location_id,starts_at,ends_at,status,admin_note,created_at,trainer_id",
      )
      .eq("location_id", locationId)
      .gte("starts_at", from.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at", { ascending: true }),
    supabase.from("trainers").select("id,name,active").eq("active", true),
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
  const fromIso = warsawTodayIso(days[0]);
  const untilIso = warsawTodayIso(days[6]);

  let bookingRows: BookingWithCustomer[] = [];
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
        "id,kind,slot_id,recurring_class_id,event_id,first_name,last_name,phone,email,message,dance_type,status,payment_option,payment_status,stripe_checkout_session_id,amount_cents,consent_rodo,created_at,customer_id,package_id,lesson_no,confirmed_at,customers(kind,partner_first_name,partner_last_name,guardian_name,guardian_phone),packages(id,kind,label,total_lessons,wedding_date,songs,status)",
      )
      .or(filters.join(","))
      .order("created_at", { ascending: true });

    bookingRows = asList(bookingsResult.data as BookingWithCustomer[] | null);
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

  const todayIso = warsawTodayIso();
  const customerIds = bookingRows
    .map((row) => row.customer_id)
    .filter((id): id is string => Boolean(id));
  const [{ packages, usedByPackageId }, cancelledResult] = await Promise.all([
    loadGroupPassData(supabase, customerIds),
    classIds.length > 0
      ? supabase
          .from("class_sessions")
          .select("recurring_class_id,session_date")
          .eq("status", "cancelled")
          .in("recurring_class_id", classIds)
          .gte("session_date", fromIso)
          .lte("session_date", untilIso)
      : Promise.resolve({ data: [] }),
  ]);

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

  const classes: AdminClass[] = classRows.map((row) => {
    const all = bookingsByClass.get(row.id) ?? [];
    const active = all.filter((item) => isActive(item.status));
    const type = types.get(row.class_type_id);
    return {
      id: row.id,
      locationId: row.location_id,
      weekday: row.weekday,
      startTime: row.start_time,
      durationMin: row.duration_min,
      name: type?.name ?? "Zajęcia",
      slug: type?.slug ?? "",
      level: row.level,
      signupOpen: row.signup_open,
      taken: active.length,
      capacity: row.capacity,
      trainerId: row.trainer_id,
      bookings: all,
      members: buildGroupMembers({
        bookings: all,
        packages,
        usedByPackageId,
        classId: row.id,
        todayIso,
      }),
      cancelledDates: cancelledByClass.get(row.id) ?? [],
    };
  });

  const slots: AdminSlot[] = slotRows.map((row) => ({
    id: row.id,
    locationId: row.location_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    adminNote: row.admin_note,
    trainerId: row.trainer_id,
    booking: bookingBySlot.get(row.id) ?? null,
  }));

  const trainers = sortTrainers(
    asList(trainersResult.data as TrainerRow[] | null),
  );

  return { classes, slots, trainers };
}
