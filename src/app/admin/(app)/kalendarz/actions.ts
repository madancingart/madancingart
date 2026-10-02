"use server";

import { addMinutes, addWeeks } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  addSlotsSchema,
  bookingIdSchema,
  cancelBookingSchema,
  classSettingsSchema,
  createSlotSeriesSchema,
  moveBookingSchema,
  slotIdSchema,
  slotSeriesOccupancySchema,
  slotTrainerSchema,
} from "@/lib/admin/calendar-validation";
import { formatBookingWhen, fromDatetimeLocal, toWarsaw } from "@/lib/datetime";
import {
  addIsoDays,
  applyCollisions,
  generateSlotSeries,
  occupiedFromClasses,
  occupiedFromTrainerSlots,
  slotKey,
} from "@/lib/slot-series";
import { sendConfirmationReminderForBooking } from "@/lib/booking/reminders";
import { confirmationHref } from "@/lib/booking/confirmation-window";
import { sendSlotCancelledBySchoolEmail, sendSlotMovedEmail } from "@/lib/email";
import { site } from "@/content/site";
import {
  enrollmentBillingMode,
  findPriceItem,
} from "@/content/pricing";
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
  revalidatePath("/admin/klienci", "layout");
  revalidatePath("/grafik");
  revalidatePath("/admin");
}

export async function markBookingConfirmedByPhone(
  input: unknown,
): Promise<ActionResult> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator zapisu.");
  }

  const { user, supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", parsed.data.bookingId)
    .neq("status", "cancelled")
    .is("confirmed_at", null)
    .select("id,customer_id")
    .maybeSingle();

  if (error) {
    return fail("Nie udało się oznaczyć potwierdzenia.");
  }
  if (!data) {
    return fail("Rezerwacja jest już potwierdzona albo anulowana.");
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    actor_label: "ola",
    action: "booking.confirmed_phone",
    entity: "booking",
    entity_id: data.id as string,
    customer_id: (data.customer_id as string | null) ?? null,
    details: { channel: "phone" },
  });

  revalidateCalendar();
  return { ok: true, message: "Oznaczono jako potwierdzone." };
}

export async function resendConfirmationReminder(
  input: unknown,
): Promise<ActionResult> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator zapisu.");
  }

  const { user, supabase } = await requireAdmin();
  const result = await sendConfirmationReminderForBooking({
    supabase,
    bookingId: parsed.data.bookingId,
    actorId: user.id,
    actorLabel: "ola",
    manual: true,
  });
  if (!result.ok) {
    return fail(result.error);
  }
  revalidateCalendar();
  return { ok: true, message: "Wysłano prośbę o potwierdzenie." };
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
  const parsed = cancelBookingSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator zapisu.");
  }

  const { supabase } = await requireAdmin();
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id,kind,first_name,email,status,slot_id,slots(starts_at,ends_at,location_id)",
    )
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  const { error } = await supabase.rpc("admin_cancel_booking", {
    p_booking_id: parsed.data.bookingId,
  });

  if (error) {
    if (error.message.includes("booking_not_found")) {
      return fail("Nie znaleziono zapisu.");
    }
    return fail("Nie udało się anulować zapisu.");
  }

  if (
    parsed.data.notifyClient &&
    booking &&
    booking.kind === "slot" &&
    booking.status !== "cancelled"
  ) {
    const email = (booking.email as string | null)?.trim() ?? "";
    const slot = slotEmbed(
      booking.slots as
        | { starts_at: string; ends_at: string; location_id: string }
        | { starts_at: string; ends_at: string; location_id: string }[]
        | null,
    );
    if (email.includes("@") && slot) {
      await sendSlotCancelledBySchoolEmail({
        email,
        firstName: booking.first_name as string,
        when: formatBookingWhen(toWarsaw(slot.starts_at), toWarsaw(slot.ends_at)),
        locationLine: locationLine(slot.location_id),
      });
    }
  }

  revalidateCalendar();
  return { ok: true };
}

function slotEmbed(
  value:
    | { starts_at: string; ends_at: string; location_id: string }
    | { starts_at: string; ends_at: string; location_id: string }[]
    | null,
): { starts_at: string; ends_at: string; location_id: string } | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function locationLine(locationId: string): string {
  const location = site.locations.find((item) => item.id === locationId);
  return [location?.city, location?.address].filter(Boolean).join(", ");
}

export async function moveBooking(input: unknown): Promise<ActionResult> {
  const parsed = moveBookingSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawne dane przeniesienia.");
  }

  const { supabase } = await requireAdmin();
  const { data: before } = await supabase
    .from("bookings")
    .select(
      "id,kind,status,first_name,email,slot_id,slots(starts_at,ends_at,location_id)",
    )
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  const { error } = await supabase.rpc("admin_move_booking", {
    p_booking_id: parsed.data.bookingId,
    p_new_slot_id: parsed.data.newSlotId,
  });

  if (error) {
    if (error.message.includes("slot_unavailable")) {
      return fail("Wybrany termin jest już zajęty.");
    }
    if (error.message.includes("booking_not_found")) {
      return fail("Nie znaleziono zapisu.");
    }
    if (error.message.includes("same_slot")) {
      return fail("Wybierz inny termin niż obecny.");
    }
    if (error.message.includes("not_slot_booking")) {
      return fail("Przenieść można tylko lekcję indywidualną.");
    }
    return fail("Nie udało się przenieść rezerwacji.");
  }

  const { data: after } = await supabase
    .from("bookings")
    .select(
      "first_name,email,confirm_token,slots(starts_at,ends_at,location_id)",
    )
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  const fromSlot = slotEmbed(
    (before?.slots as
      | { starts_at: string; ends_at: string; location_id: string }
      | { starts_at: string; ends_at: string; location_id: string }[]
      | null) ?? null,
  );
  const toSlot = slotEmbed(
    (after?.slots as
      | { starts_at: string; ends_at: string; location_id: string }
      | { starts_at: string; ends_at: string; location_id: string }[]
      | null) ?? null,
  );
  const email = (after?.email as string | null)?.trim() ?? "";
  let mailed = false;
  if (email.includes("@") && fromSlot && toSlot && after) {
    mailed = await sendSlotMovedEmail({
      email,
      firstName: after.first_name as string,
      fromWhen: formatBookingWhen(
        toWarsaw(fromSlot.starts_at),
        toWarsaw(fromSlot.ends_at),
      ),
      fromLocation: locationLine(fromSlot.location_id),
      toWhen: formatBookingWhen(
        toWarsaw(toSlot.starts_at),
        toWarsaw(toSlot.ends_at),
      ),
      toLocation: locationLine(toSlot.location_id),
      confirmUrl: confirmationHref(after.confirm_token as string),
    });
  }

  revalidateCalendar();
  return {
    ok: true,
    message: mailed
      ? "Przeniesiono termin i wysłano mail do klienta."
      : "Przeniesiono termin.",
  };
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
  const { data: classRow } = await supabase
    .from("recurring_classes")
    .select("id, location_id")
    .eq("id", parsed.data.classId)
    .maybeSingle();

  if (!classRow) {
    return fail("Nie znaleziono grupy.");
  }

  const priceItem = parsed.data.priceItemId
    ? findPriceItem(parsed.data.priceItemId)
    : null;
  if (parsed.data.priceItemId && (!priceItem || priceItem.locationId !== classRow.location_id)) {
    return fail("Ta pozycja nie należy do cennika tej lokalizacji.");
  }

  const { error } = await supabase
    .from("recurring_classes")
    .update({
      signup_open: parsed.data.signupOpen,
      capacity: parsed.data.capacity,
      trainer_id: parsed.data.trainerId,
      price_item_id: parsed.data.priceItemId,
    })
    .eq("id", parsed.data.classId);

  if (error) {
    return fail("Nie udało się zapisać ustawień grupy.");
  }

  const billingMode = priceItem ? enrollmentBillingMode(priceItem) : null;
  if (billingMode) {
    const { error: enrollmentError } = await supabase
      .from("enrollments")
      .update({ billing_mode: billingMode })
      .eq("recurring_class_id", parsed.data.classId)
      .in("status", ["pending", "active", "paused"]);
    if (enrollmentError) {
      return fail("Cenę zapisano, ale nie udało się ustawić rozliczenia zapisów.");
    }
  }

  revalidateCalendar();
  revalidatePath(`/admin/grupy/${parsed.data.classId}`);
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
