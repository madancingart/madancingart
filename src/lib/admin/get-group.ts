import "server-only";

import { buildGroupMembers } from "@/lib/admin/group-members";
import { loadGroupPassData } from "@/lib/admin/load-group-passes";
import { warsawTodayIso } from "@/lib/datetime";
import type {
  AdminBooking,
  AdminGroupDetail,
} from "@/lib/admin/calendar-types";
import type {
  BookingStatus,
  ClassTypeRow,
  CustomerKind,
  LocationId,
  PaymentStatus,
  RecurringClassRow,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type CustomerEmbed = {
  kind: CustomerKind;
  partner_first_name: string | null;
  partner_last_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
};

function customerFromEmbed(
  value: CustomerEmbed | CustomerEmbed[] | null,
): CustomerEmbed | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getAdminGroup(
  supabase: SupabaseClient,
  classId: string,
): Promise<AdminGroupDetail | null> {
  const { data: row } = await supabase
    .from("recurring_classes")
    .select(
      "id,location_id,class_type_id,weekday,start_time,duration_min,level,capacity,signup_open,active,trainer_id",
    )
    .eq("id", classId)
    .maybeSingle();

  if (!row) {
    return null;
  }

  const classRow = row as RecurringClassRow;
  const { data: typeRow } = await supabase
    .from("class_types")
    .select("id,slug,name,is_pair,color")
    .eq("id", classRow.class_type_id)
    .maybeSingle();
  const type = typeRow as ClassTypeRow | null;

  const { data: bookingData } = await supabase
    .from("bookings")
    .select(
      "id,first_name,last_name,phone,email,status,payment_status,created_at,customer_id,customers(kind,partner_first_name,partner_last_name,guardian_name,guardian_phone)",
    )
    .eq("recurring_class_id", classId)
    .order("created_at", { ascending: true });

  const bookings: AdminBooking[] = (bookingData ?? []).map((item) => {
    const customer = customerFromEmbed(
      (item as { customers: CustomerEmbed | CustomerEmbed[] | null }).customers,
    );
    return {
      id: item.id as string,
      firstName: item.first_name as string,
      lastName: (item.last_name as string | null) ?? null,
      phone: (item.phone as string | null) ?? null,
      email: (item.email as string | null) ?? null,
      message: null,
      danceType: null,
      status: item.status as BookingStatus,
      paymentStatus: item.payment_status as PaymentStatus,
      createdAt: item.created_at as string,
      slotId: null,
      recurringClassId: classId,
      customerId: (item.customer_id as string | null) ?? null,
      customerKind: customer?.kind ?? null,
      partnerFirstName: customer?.partner_first_name ?? null,
      partnerLastName: customer?.partner_last_name ?? null,
      guardianName: customer?.guardian_name ?? null,
      guardianPhone: customer?.guardian_phone ?? null,
      packageId: null,
      lessonNo: null,
      weddingPackage: null,
    };
  });

  const { packages, usedByPackageId } = await loadGroupPassData(
    supabase,
    bookings
      .map((item) => item.customerId)
      .filter((id): id is string => Boolean(id)),
  );

  const active = bookings.filter((item) => item.status !== "cancelled");
  const locationId = classRow.location_id as LocationId;

  return {
    id: classRow.id,
    locationId,
    weekday: classRow.weekday,
    startTime: classRow.start_time,
    durationMin: classRow.duration_min,
    name: type?.name ?? "Zajęcia",
    slug: type?.slug ?? "",
    level: classRow.level,
    signupOpen: classRow.signup_open,
    taken: active.length,
    capacity: classRow.capacity,
    trainerId: classRow.trainer_id,
    bookings,
    members: buildGroupMembers({
      bookings,
      packages,
      usedByPackageId,
      classId,
      todayIso: warsawTodayIso(),
    }),
  };
}
