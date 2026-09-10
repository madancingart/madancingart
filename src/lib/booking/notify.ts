import "server-only";

import { sendBookingEmails } from "@/lib/email";
import { resolveBookingTerm } from "@/lib/booking/term";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingKind, CustomerKind } from "@/lib/types";

type CustomerEmbed = {
  kind: CustomerKind | null;
  partner_first_name: string | null;
  partner_last_name: string | null;
  guardian_name: string | null;
};

type BookingNotifyRow = {
  id: string;
  kind: BookingKind;
  slot_id: string | null;
  recurring_class_id: string | null;
  event_id: string | null;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  dance_type: string | null;
  customers: CustomerEmbed | CustomerEmbed[] | null;
};

export async function notifyBookingById(bookingId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id,kind,slot_id,recurring_class_id,event_id,first_name,last_name,phone,email,message,dance_type,customers(kind,partner_first_name,partner_last_name,guardian_name)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    console.error("Nie znaleziono zapisu do powiadomienia.", error);
    return;
  }

  const row = data as BookingNotifyRow;
  const targetId = row.slot_id ?? row.recurring_class_id ?? row.event_id;
  if (!targetId || !row.email || !row.phone) {
    return;
  }

  const rawCustomer = row.customers;
  const customer = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;

  const term = await resolveBookingTerm(supabase, {
    kind: row.kind,
    targetId,
    startsAt: new Date().toISOString(),
    endsAt: new Date().toISOString(),
    fallbackTitle:
      row.kind === "slot" ? "Lekcja indywidualna" : "Zapis",
    fallbackLocationId: "mikolow",
  });

  await sendBookingEmails({
    kind: row.kind,
    firstName: row.first_name,
    lastName: row.last_name ?? "",
    phone: row.phone,
    email: row.email,
    message: row.message ?? "",
    danceType: row.dance_type,
    customerKind: customer?.kind ?? undefined,
    partnerFirstName: customer?.partner_first_name ?? null,
    partnerLastName: customer?.partner_last_name ?? null,
    guardianName: customer?.guardian_name ?? null,
    term,
  });
}
