"use server";

import { addMinutes, addWeeks } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  addSlotsSchema,
  bookingIdSchema,
  classSettingsSchema,
  createSlotSeriesSchema,
  slotIdSchema,
  slotSeriesOccupancySchema,
  slotTrainerSchema,
} from "@/lib/admin/calendar-validation";
import { fromDatetimeLocal } from "@/lib/datetime";
import {
  addIsoDays,
  applyCollisions,
  generateSlotSeries,
  occupiedFromClasses,
  occupiedFromTrainerSlots,
  slotKey,
} from "@/lib/slot-series";
import type { ClassTypeRow, RecurringClassRow } from "@/lib/types";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
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
      trainer_id: parsed.data.trainerId,
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
    return fail("Sprawdź datę, czas trwania, prowadzącego i liczbę tygodni.");
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
      trainer_id: parsed.data.trainerId,
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

export async function updateSlotTrainer(
  input: unknown,
): Promise<ActionResult> {
  const parsed = slotTrainerSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny prowadzący.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("slots")
    .update({ trainer_id: parsed.data.trainerId })
    .eq("id", parsed.data.slotId);

  if (error) {
    return fail("Nie udało się zapisać prowadzącego.");
  }

  revalidateCalendar();
  return { ok: true };
}

export type SlotSeriesOccupancy = {
  trainerSlots: { startsAt: string; endsAt: string }[];
  classes: {
    weekday: number;
    startTime: string;
    durationMin: number;
    name: string;
  }[];
};

export async function getSlotSeriesOccupancy(
  input: unknown,
): Promise<{ ok: true; data: SlotSeriesOccupancy } | { ok: false; error: string }> {
  const parsed = slotSeriesOccupancySchema.safeParse(input);
  if (!parsed.success) {
    return fail("Sprawdź zakres dat i lokalizację.");
  }

  const from = fromDatetimeLocal(`${parsed.data.fromDate}T00:00`);
  const until = fromDatetimeLocal(
    `${addIsoDays(parsed.data.toDate, 1)}T00:00`,
  );
  const trainerId = parsed.data.trainerId?.trim() ?? "";

  const { supabase } = await requireAdmin();
  const [classesResult, typesResult, slotsResult] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "weekday,start_time,duration_min,class_type_id,active,location_id",
      )
      .eq("active", true)
      .eq("location_id", parsed.data.locationId),
    supabase.from("class_types").select("id,name"),
    trainerId
      ? supabase
          .from("slots")
          .select("starts_at,ends_at")
          .eq("trainer_id", trainerId)
          .gte("starts_at", from.toISOString())
          .lt("starts_at", until.toISOString())
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (classesResult.error || typesResult.error || slotsResult.error) {
    return fail("Nie udało się sprawdzić kolizji.");
  }

  const types = new Map(
    ((typesResult.data as Pick<ClassTypeRow, "id" | "name">[] | null) ?? []).map(
      (row) => [row.id, row.name],
    ),
  );
  const classes = (
    (classesResult.data as Pick<
      RecurringClassRow,
      "weekday" | "start_time" | "duration_min" | "class_type_id"
    >[] | null) ?? []
  ).map((row) => ({
    weekday: row.weekday,
    startTime: row.start_time,
    durationMin: row.duration_min,
    name: types.get(row.class_type_id) ?? "zajęcia grupowe",
  }));

  const trainerSlots = (
    (slotsResult.data as { starts_at: string; ends_at: string }[] | null) ??
    []
  ).map((row) => ({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));

  return { ok: true, data: { trainerSlots, classes } };
}

export async function createSlotSeries(input: unknown): Promise<ActionResult> {
  const parsed = createSlotSeriesSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Sprawdź zakres, dni, okna i prowadzącego.");
  }

  const params = parsed.data;
  const generated = generateSlotSeries({
    fromDate: params.fromDate,
    toDate: params.toDate,
    weekdays: params.weekdays,
    windows: params.windows,
    durationMin: params.durationMin,
    breakMin: params.breakMin,
  });

  const occupancy = await getSlotSeriesOccupancy({
    locationId: params.locationId,
    trainerId: params.trainerId,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
  if (!occupancy.ok) {
    return occupancy;
  }

  const preview = applyCollisions(generated, [
    ...occupiedFromClasses(
      occupancy.data.classes,
      params.fromDate,
      params.toDate,
    ),
    ...occupiedFromTrainerSlots(occupancy.data.trainerSlots),
  ]);
  const allowed = new Map(
    preview
      .filter((slot) => slot.conflict === null)
      .map((slot) => [slot.key, slot]),
  );

  const unique = new Map<string, { date: string; start: string }>();
  for (const item of params.selected) {
    unique.set(slotKey(item.date, item.start), item);
  }

  const rows = [];
  for (const item of unique.values()) {
    const slot = allowed.get(slotKey(item.date, item.start));
    if (!slot) {
      return fail(
        "Część zaznaczonych terminów koliduje albo wygasła. Odśwież podgląd.",
      );
    }
    const starts = fromDatetimeLocal(`${slot.date}T${slot.start}`);
    const ends = fromDatetimeLocal(`${slot.date}T${slot.end}`);
    rows.push({
      location_id: params.locationId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: "open" as const,
      trainer_id: params.trainerId,
    });
  }

  if (rows.length === 0) {
    return fail("Zaznacz terminy do utworzenia.");
  }

  const { user, supabase } = await requireAdmin();
  const chunkSize = 150;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await supabase
      .from("slots")
      .insert(rows.slice(index, index + chunkSize));
    if (error) {
      return fail("Nie udało się dodać serii terminów.");
    }
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    actor_id: user.id,
    actor_label: "admin",
    action: "slots.bulk_created",
    entity: "slots",
    details: {
      count: rows.length,
      from: params.fromDate,
      to: params.toDate,
      locationId: params.locationId,
      trainerId: params.trainerId,
    },
  });

  if (auditError) {
    return fail("Terminy zapisane, ale nie udało się dodać wpisu w dzienniku.");
  }

  revalidateCalendar();
  return { ok: true };
}
