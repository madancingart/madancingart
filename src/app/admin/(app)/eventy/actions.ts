"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { eventFormSchema } from "@/lib/admin/event-validation";
import { fromDatetimeLocal } from "@/lib/datetime";
import { z } from "zod";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function revalidateEvents() {
  revalidatePath("/admin/eventy");
  revalidatePath("/grafik");
  revalidatePath("/admin");
}

export async function saveEvent(input: unknown): Promise<ActionResult> {
  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Sprawdź formularz.");
  }

  const start = fromDatetimeLocal(`${parsed.data.date}T${parsed.data.startTime}`);
  const end = fromDatetimeLocal(`${parsed.data.date}T${parsed.data.endTime}`);
  if (!(end.getTime() > start.getTime())) {
    return fail("Godzina końca musi być późniejsza niż start.");
  }

  const row = {
    title: parsed.data.title,
    description: parsed.data.description?.length
      ? parsed.data.description
      : null,
    location_id: parsed.data.locationId === "" ? null : parsed.data.locationId,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    capacity:
      parsed.data.capacity === "" ? null : Number(parsed.data.capacity),
    signup_open: parsed.data.signupOpen,
    published: parsed.data.published,
  };

  const { supabase } = await requireAdmin();

  if (parsed.data.id) {
    const { error } = await supabase
      .from("events")
      .update(row)
      .eq("id", parsed.data.id);
    if (error) {
      return fail("Nie udało się zapisać wydarzenia.");
    }
    revalidateEvents();
    return { ok: true, id: parsed.data.id };
  }

  const { data, error } = await supabase
    .from("events")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return fail("Nie udało się dodać wydarzenia.");
  }

  revalidateEvents();
  return { ok: true, id: data.id as string };
}

export async function deleteEvent(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ eventId: z.uuid() }).safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator.");
  }

  const { supabase } = await requireAdmin();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("event_id", parsed.data.eventId);

  if ((count ?? 0) > 0) {
    return fail("Nie można usunąć — są zapisy na to wydarzenie.");
  }

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", parsed.data.eventId);

  if (error) {
    return fail("Nie udało się usunąć wydarzenia.");
  }

  revalidateEvents();
  return { ok: true };
}
