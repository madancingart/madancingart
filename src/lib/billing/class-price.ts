import "server-only";

import { findPriceItem, type LocatedPriceItem } from "@/content/pricing";
import type { BillingClass } from "@/lib/billing/engine";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillableClass = {
  cls: BillingClass;
  priceItem: LocatedPriceItem | null;
  cancelledDates: string[];
};

export async function loadBillableClass(classId: string): Promise<BillableClass | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("recurring_classes")
    .select("weekday, start_time, price_item_id, active")
    .eq("id", classId)
    .maybeSingle();
  const row = data as {
    weekday: number;
    start_time: string;
    price_item_id: string | null;
    active: boolean;
  } | null;
  if (!row?.active) {
    return null;
  }

  const { data: cancelled } = await admin
    .from("class_sessions")
    .select("session_date")
    .eq("recurring_class_id", classId)
    .eq("status", "cancelled");

  return {
    cls: { weekday: row.weekday, startTime: row.start_time.slice(0, 5) },
    priceItem: row.price_item_id ? findPriceItem(row.price_item_id) : null,
    cancelledDates: ((cancelled ?? []) as { session_date: string }[]).map((item) =>
      item.session_date.slice(0, 10),
    ),
  };
}
