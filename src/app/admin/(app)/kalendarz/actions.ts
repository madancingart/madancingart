"use server";

import { addMinutes, addWeeks } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  addSlotsSchema,
  bookingIdSchema,
  classSettingsSchema,
  slotIdSchema,
} from "@/lib/admin/calendar-validation";
import { fromDatetimeLocal } from "@/lib/datetime";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function revalidateCalendar() {
  revalidatePath("/admin/kalendarz");
  revalidatePath("/admin/zapisy");
  revalidatePath("/grafik");
  revalidatePath("/admin");
}

export async function confirmBooking(input: unknown): Promise<ActionResult> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator zapisu.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", parsed.data.bookingId)
    .neq("status", "cancelled");

  if (error) {
    return fail("Nie udało się potwierdzić zapisu.");
  }

  revalidateCalendar();
  return { ok: true };
}

export async function cancelBooking(input: unknown): Promise<ActionResult> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator zapisu.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_cancel_booking", {
    p_booking_id: parsed.data.bookingId,
  });

  if (error) {
    if (error.message.includes("booking_not_found")) {
      return fail("Nie znaleziono zapisu.");
    }
    return fail("Nie udało się anulować zapisu.");
  }

  revalidateCalendar();
  return { ok: true };
}

export async function anonymizeBooking(input: unknown): Promise<ActionResult> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator zapisu.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_anonymize_booking", {
    p_booking_id: parsed.data.bookingId,
  });

  if (error) {
    if (error.message.includes("booking_not_found")) {
      return fail("Nie znaleziono zapisu.");
    }
    return fail("Nie udało się usunąć danych.");
  }

  revalidateCalendar();
  return { ok: true };
}

export async function blockSlot(input: unknown): Promise<ActionResult> {
  const parsed = slotIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator terminu.");
  }

  const { supabase } = await requireAdmin();
  const { data: slot } = await supabase
    .from("slots")
    .select("id,status")
    .eq("id", parsed.data.slotId)
    .maybeSingle();

  if (!slot) {
    return fail("Nie znaleziono terminu.");
  }
  if (slot.status === "booked") {
    return fail("Najpierw anuluj rezerwację, potem zablokuj termin.");
  }

  const { error } = await supabase
    .from("slots")
    .update({ status: "blocked" })
    .eq("id", parsed.data.slotId);

  if (error) {
    return fail("Nie udało się zablokować terminu.");
  }

  revalidateCalendar();
  return { ok: true };
}

export async function unblockSlot(input: unknown): Promise<ActionResult> {
  const parsed = slotIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator terminu.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("slots")
    .update({ status: "open" })
    .eq("id", parsed.data.slotId)
    .eq("status", "blocked");

  if (error) {
    return fail("Nie udało się odblokować terminu.");
  }

  revalidateCalendar();
  return { ok: true };
}

export async function deleteSlot(input: unknown): Promise<ActionResult> {
  const parsed = slotIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator terminu.");
  }

  const { supabase } = await requireAdmin();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", parsed.data.slotId);

  if ((count ?? 0) > 0) {
    return fail("Nie można usunąć terminu — są powiązane zapisy.");
  }

  const { error } = await supabase
    .from("slots")
    .delete()
    .eq("id", parsed.data.slotId);

  if (error) {
    return fail("Nie udało się usunąć terminu.");
  }

  revalidateCalendar();
  return { ok: true };
}

export async function updateClassSettings(
  input: unknown,
): Promise<ActionResult> {
  const parsed = classSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Sprawdź pojemność grupy (1–80).");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("recurring_classes")
    .update({
      signup_open: parsed.data.signupOpen,
      capacity: parsed.data.capacity,
    })
    .eq("id", parsed.data.classId);

  if (error) {
    return fail("Nie udało się zapisać ustawień grupy.");
  }

  revalidateCalendar();
  return { ok: true };
}

export async function addOpenSlots(input: unknown): Promise<ActionResult> {
  const parsed = addSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Sprawdź datę, czas trwania i liczbę tygodni.");
  }

  const start = fromDatetimeLocal(parsed.data.startsAt);
  if (Number.isNaN(start.getTime())) {
    return fail("Niepoprawna data lub godzina.");
  }

  const rows = Array.from({ length: parsed.data.weeks }, (_, index) => {
    const starts = addWeeks(start, index);
    const ends = addMinutes(starts, parsed.data.durationMin);
    return {
      location_id: parsed.data.locationId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: "open" as const,
    };
  });

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("slots").insert(rows);

  if (error) {
    return fail("Nie udało się dodać terminów.");
  }

  revalidateCalendar();
  return { ok: true };
}
