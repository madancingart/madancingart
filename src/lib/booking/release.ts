import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function releaseUnpaidBooking(bookingId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id,kind,slot_id,status,payment_status")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    return;
  }

  if (data.status === "cancelled" || data.payment_status === "paid") {
    return;
  }

  const { error: cancelError } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .neq("payment_status", "paid");

  if (cancelError) {
    throw cancelError;
  }

  if (data.kind === "slot" && data.slot_id) {
    const { error: slotError } = await supabase
      .from("slots")
      .update({ status: "open" })
      .eq("id", data.slot_id);
    if (slotError) {
      throw slotError;
    }
  }
}
