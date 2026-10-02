import "server-only";

import type { BillingClass } from "@/lib/billing/engine";
import { site } from "@/content/site";
import { weekdayLongLabel } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunk } from "@/lib/jobs/chunk";

export type ClassRecord = {
  id: string;
  name: string;
  location: string;
  weekday: string;
  time: string;
  billing: BillingClass;
  priceItemId: string | null;
};

function city(locationId: string): string {
  return site.locations.find((item) => item.id === locationId)?.city ?? locationId;
}

export async function loadClasses(classIds: string[]): Promise<Map<string, ClassRecord>> {
  const ids = [...new Set(classIds)];
  const result = new Map<string, ClassRecord>();
  if (ids.length === 0) {
    return result;
  }
  const admin = createAdminClient();
  const rows: {
    id: string;
    location_id: string;
    class_type_id: string;
    weekday: number;
    start_time: string;
    price_item_id: string | null;
  }[] = [];
  for (const slice of chunk(ids, 100)) {
    const { data, error } = await admin
      .from("recurring_classes")
      .select("id, location_id, class_type_id, weekday, start_time, price_item_id")
      .in("id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać grup.");
    }
    rows.push(
      ...((data ?? []) as {
        id: string;
        location_id: string;
        class_type_id: string;
        weekday: number;
        start_time: string;
        price_item_id: string | null;
      }[]),
    );
  }
  const typeIds = [...new Set(rows.map((row) => row.class_type_id))];
  const names = new Map<string, string>();
  for (const slice of chunk(typeIds, 100)) {
    const { data, error } = await admin.from("class_types").select("id, name").in("id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać nazw zajęć.");
    }
    for (const row of (data ?? []) as { id: string; name: string }[]) {
      names.set(row.id, row.name);
    }
  }
  for (const row of rows) {
    result.set(row.id, {
      id: row.id,
      name: names.get(row.class_type_id) ?? "Zajęcia",
      location: city(row.location_id),
      weekday: weekdayLongLabel(row.weekday),
      time: row.start_time.slice(0, 5),
      billing: { weekday: row.weekday, startTime: row.start_time.slice(0, 5) },
      priceItemId: row.price_item_id,
    });
  }
  return result;
}

export async function loadCancelledDates(
  classIds: string[],
): Promise<Map<string, string[]>> {
  const ids = [...new Set(classIds)];
  const result = new Map<string, string[]>();
  if (ids.length === 0) {
    return result;
  }
  const admin = createAdminClient();
  for (const slice of chunk(ids, 100)) {
    const { data, error } = await admin
      .from("class_sessions")
      .select("recurring_class_id, session_date")
      .eq("status", "cancelled")
      .in("recurring_class_id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać odwołanych zajęć.");
    }
    for (const row of (data ?? []) as { recurring_class_id: string; session_date: string }[]) {
      const list = result.get(row.recurring_class_id) ?? [];
      list.push(row.session_date.slice(0, 10));
      result.set(row.recurring_class_id, list);
    }
  }
  return result;
}

export function locationCity(locationId: string | null): string {
  if (!locationId) {
    return "";
  }
  return city(locationId);
}
