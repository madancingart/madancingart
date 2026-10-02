import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SignupGroup = {
  id: string;
  locationId: string;
  typeId: string;
  typeName: string;
  weekday: number;
  startTime: string;
  level: string | null;
  taken: number;
  capacity: number;
  signupOpen: boolean;
};

type ClassRow = {
  id: string;
  location_id: string;
  class_type_id: string;
  weekday: number;
  start_time: string;
  level: string | null;
  capacity: number;
  signup_open: boolean;
  class_types: { name: string } | { name: string }[] | null;
};

export async function loadSignupGroups(): Promise<SignupGroup[]> {
  const supabase = await createClient();
  const [classesResult, occupancyResult] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id, location_id, class_type_id, weekday, start_time, level, capacity, signup_open, class_types(name)",
      )
      .eq("active", true)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase.from("class_occupancy").select("recurring_class_id, taken, capacity"),
  ]);

  if (classesResult.error) {
    return [];
  }

  const seats = new Map(
    ((occupancyResult.data ?? []) as { recurring_class_id: string; taken: number; capacity: number }[]).map(
      (row) => [row.recurring_class_id, row],
    ),
  );

  return ((classesResult.data ?? []) as ClassRow[]).map((row) => {
    const type = Array.isArray(row.class_types) ? row.class_types[0] : row.class_types;
    const seat = seats.get(row.id);
    return {
      id: row.id,
      locationId: row.location_id,
      typeId: row.class_type_id,
      typeName: type?.name ?? "Zajęcia",
      weekday: row.weekday,
      startTime: row.start_time.slice(0, 5),
      level: row.level,
      taken: Number(seat?.taken ?? 0),
      capacity: Number(seat?.capacity ?? row.capacity),
      signupOpen: row.signup_open,
    };
  });
}
