import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { site } from "@/content/site";
import {
  confirmationHref,
  isAutoReleaseEnabled,
  isInReminderWindow,
  isUnconfirmedUrgent,
} from "@/lib/booking/confirmation-window";
import { formatBookingWhen, toWarsaw } from "@/lib/datetime";
import {
  sendSlotConfirmationReminderEmail,
  sendSlotReleasedEmail,
} from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

type SlotEmbed = {
  id: string;
  starts_at: string;
  ends_at: string;
  location_id: string;
  status: string;
};

type ReminderBooking = {
  id: string;
  customer_id: string | null;
  first_name: string;
  email: string | null;
  confirm_token: string;
  confirmed_at: string | null;
  reminder_sent_at: string | null;
  status: string;
  slot_id: string;
  slots: SlotEmbed | SlotEmbed[] | null;
};

function slotOf(row: ReminderBooking): SlotEmbed | null {
  const value = row.slots;
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function locationLine(locationId: string): string {
  const location = site.locations.find((item) => item.id === locationId);
  return [location?.city, location?.address].filter(Boolean).join(", ");
}

function termLines(slot: SlotEmbed): { when: string; locationLine: string } {
  return {
    when: formatBookingWhen(toWarsaw(slot.starts_at), toWarsaw(slot.ends_at)),
    locationLine: locationLine(slot.location_id),
  };
}

async function writeAudit(
  supabase: SupabaseClient,
  input: {
    action: string;
    bookingId: string;
    customerId: string | null;
    details: Record<string, unknown>;
    actorId?: string | null;
    actorLabel?: string;
  },
): Promise<void> {
  await supabase.from("audit_log").insert({
    actor_id: input.actorId ?? null,
    actor_label: input.actorLabel ?? "system",
    action: input.action,
    entity: "booking",
    entity_id: input.bookingId,
    customer_id: input.customerId,
    details: input.details,
  });
}

export async function sendConfirmationReminderForBooking(input: {
  supabase: SupabaseClient;
  bookingId: string;
  actorId?: string | null;
  actorLabel?: string;
  manual?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await input.supabase
    .from("bookings")
    .select(
      "id,customer_id,first_name,email,confirm_token,confirmed_at,reminder_sent_at,status,slot_id,slots(id,starts_at,ends_at,location_id,status)",
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (!data) {
    return { ok: false, error: "Nie znaleziono rezerwacji." };
  }
  const row = data as ReminderBooking;
  if (row.status === "cancelled") {
    return { ok: false, error: "Rezerwacja jest anulowana." };
  }
  if (row.confirmed_at) {
    return { ok: false, error: "Termin jest już potwierdzony." };
  }
  if (!row.email) {
    return { ok: false, error: "Brak e-maila — nie można wysłać prośby." };
  }
  const slot = slotOf(row);
  if (!slot) {
    return { ok: false, error: "Brak terminu indywidualnego." };
  }
  if (new Date(slot.starts_at).getTime() <= Date.now()) {
    return { ok: false, error: "Termin już się zaczął." };
  }

  const term = termLines(slot);
  const sent = await sendSlotConfirmationReminderEmail({
    email: row.email,
    firstName: row.first_name,
    confirmUrl: confirmationHref(row.confirm_token),
    when: term.when,
    locationLine: term.locationLine,
  });
  if (!sent) {
    return { ok: false, error: "Nie udało się wysłać wiadomości." };
  }

  const { error: updateError } = await input.supabase
    .from("bookings")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("confirmed_at", null)
    .neq("status", "cancelled");

  if (updateError) {
    return { ok: false, error: "Wiadomość wyszła, ale nie zapisano znacznika." };
  }

  await writeAudit(input.supabase, {
    action: "reminder.sent",
    bookingId: row.id,
    customerId: row.customer_id,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    details: {
      channel: "email",
      manual: Boolean(input.manual),
      slot_id: slot.id,
    },
  });

  return { ok: true };
}

async function loadUpcomingSlotBookings(
  supabase: SupabaseClient,
  now: Date,
): Promise<ReminderBooking[]> {
  const until = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const { data: slots } = await supabase
    .from("slots")
    .select("id")
    .eq("status", "booked")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", until.toISOString());

  const slotIds = (slots ?? []).map((row) => row.id as string);
  if (slotIds.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("bookings")
    .select(
      "id,customer_id,first_name,email,confirm_token,confirmed_at,reminder_sent_at,status,slot_id,slots(id,starts_at,ends_at,location_id,status)",
    )
    .eq("kind", "slot")
    .neq("status", "cancelled")
    .in("slot_id", slotIds);

  return (data ?? []) as ReminderBooking[];
}

export async function runConfirmationReminders(
  now: Date = new Date(),
  options?: {
    dryRun?: boolean;
    onPlanned?: (mail: { to: string; name: string; subject: string; when: string }) => void;
  },
): Promise<{ reminded: number; released: number; skipped: number; errors: string[] }> {
  const supabase = createAdminClient();
  const rows = await loadUpcomingSlotBookings(supabase, now);
  let reminded = 0;
  let released = 0;
  let skipped = 0;
  const errors: string[] = [];
  const autoRelease = isAutoReleaseEnabled();

  for (const row of rows) {
    const slot = slotOf(row);
    if (!slot) {
      continue;
    }
    const startsAt = toWarsaw(slot.starts_at);
    if (row.confirmed_at) {
      continue;
    }

    if (isInReminderWindow(startsAt, now)) {
      if (row.reminder_sent_at === null && row.email) {
        const term = termLines(slot);
        if (options?.dryRun) {
          options.onPlanned?.({
            to: row.email,
            name: row.first_name,
            subject: "Potwierdź swój termin — M&A Dancing Art",
            when: term.when,
          });
          reminded += 1;
        } else {
          const result = await sendConfirmationReminderForBooking({
            supabase,
            bookingId: row.id,
          });
          if (result.ok) {
            reminded += 1;
          } else {
            errors.push(result.error);
          }
        }
      } else {
        skipped += 1;
      }
      continue;
    }

    if (autoRelease && isUnconfirmedUrgent(startsAt, now)) {
      const term = termLines(slot);
      if (options?.dryRun) {
        if (row.email) {
          options.onPlanned?.({
            to: row.email,
            name: row.first_name,
            subject: "Termin zwolniony — M&A Dancing Art",
            when: term.when,
          });
        }
        released += 1;
        continue;
      }
      const { error: cancelError } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", row.id)
        .is("confirmed_at", null)
        .neq("status", "cancelled");
      if (cancelError) {
        errors.push(`Nie udało się zwolnić rezerwacji ${row.id}.`);
        continue;
      }
      await supabase.from("slots").update({ status: "open" }).eq("id", slot.id);
      if (row.email) {
        await sendSlotReleasedEmail({
          email: row.email,
          firstName: row.first_name,
          when: term.when,
          locationLine: term.locationLine,
        });
      }
      await writeAudit(supabase, {
        action: "booking.auto_released",
        bookingId: row.id,
        customerId: row.customer_id,
        details: { slot_id: slot.id, reason: "unconfirmed_24h" },
      });
      released += 1;
    }
  }

  return { reminded, released, skipped, errors };
}
