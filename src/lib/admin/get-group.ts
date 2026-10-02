import "server-only";

import { loadClassRosters } from "@/lib/admin/enrollment-members";
import { warsawTodayIso } from "@/lib/datetime";
import type {
  AdminBooking,
  AdminGroupDetail,
} from "@/lib/admin/calendar-types";
import type {
  ClassTypeRow,
  LocationId,
  RecurringClassRow,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAdminGroup(
  supabase: SupabaseClient,
  classId: string,
): Promise<AdminGroupDetail | null> {
  const { data: row } = await supabase
    .from("recurring_classes")
    .select(
      "id,location_id,class_type_id,weekday,start_time,duration_min,level,capacity,signup_open,active,trainer_id,price_item_id",
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

  const roster = await loadClassRosters(supabase, [classId], warsawTodayIso());
  const seats = roster.get(classId) ?? { taken: 0, members: [] };
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
    taken: seats.taken,
    capacity: classRow.capacity,
    trainerId: classRow.trainer_id,
    priceItemId: classRow.price_item_id,
    bookings: [] as AdminBooking[],
    members: seats.members,
  };
}
