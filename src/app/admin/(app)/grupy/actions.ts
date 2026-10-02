"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  groupPassDbLabel,
  groupPassTotalLessons,
} from "@/lib/group-pricing";
import { GROUP_PASS_KINDS } from "@/lib/billing/status";

export type GroupActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function fail(error: string): GroupActionResult {
  return { ok: false, error };
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę.");

const recordPaymentSchema = z
  .object({
    bookingId: z.uuid(),
    classId: z.uuid(),
    kind: z.enum(GROUP_PASS_KINDS),
    amountCents: z.coerce.number().int().min(100, "Podaj kwotę wpłaty."),
    paymentMethod: z.enum(["onsite", "transfer"]),
    validFrom: isoDate,
    validUntil: isoDate,
  })
  .superRefine((value, ctx) => {
    if (value.validUntil < value.validFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Data końcowa nie może być wcześniejsza niż początkowa.",
      });
    }
  });

function revalidateGroup(classId: string) {
  revalidatePath("/admin/kalendarz");
  revalidatePath("/admin/zapisy");
  revalidatePath("/admin/pakiety");
  revalidatePath("/admin/ewidencja");
  revalidatePath("/admin/klienci", "layout");
  revalidatePath(`/admin/grupy/${classId}`);
}

export async function recordGroupPayment(
  input: unknown,
): Promise<GroupActionResult> {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Sprawdź formularz wpłaty.");
  }

  const { user, supabase } = await requireAdmin();
  const data = parsed.data;

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id,recurring_class_id,customer_id,first_name,last_name,phone,email,status",
    )
    .eq("id", data.bookingId)
    .maybeSingle();

  if (!booking || booking.status === "cancelled") {
    return fail("Nie znaleziono aktywnego zapisu.");
  }
  if (booking.recurring_class_id !== data.classId) {
    return fail("Zapis nie należy do tej grupy.");
  }

  const { data: classRow } = await supabase
    .from("recurring_classes")
    .select("id,class_type_id")
    .eq("id", data.classId)
    .maybeSingle();
  if (!classRow) {
    return fail("Nie znaleziono grupy.");
  }

  const { data: typeRow } = await supabase
    .from("class_types")
    .select("name")
    .eq("id", classRow.class_type_id)
    .maybeSingle();
  const className = (typeRow?.name as string | undefined) ?? "Zajęcia";

  let customerId = booking.customer_id as string | null;
  if (!customerId) {
    if (
      !booking.first_name ||
      !booking.last_name ||
      !booking.phone ||
      !booking.email
    ) {
      return fail(
        "Brak kompletnych danych klienta — nie można odnotować wpłaty.",
      );
    }
    const { data: created, error: createError } = await supabase
      .from("customers")
      .insert({
        kind: "adult",
        first_name: booking.first_name,
        last_name: booking.last_name,
        phone: booking.phone,
        email: booking.email,
      })
      .select("id")
      .single();
    if (createError || !created) {
      return fail("Nie udało się powiązać klienta.");
    }
    customerId = created.id as string;
    await supabase
      .from("bookings")
      .update({ customer_id: customerId })
      .eq("id", booking.id);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("packages")
    .insert({
      customer_id: customerId,
      kind: data.kind,
      label: groupPassDbLabel(data.kind, className),
      total_lessons: groupPassTotalLessons(data.kind),
      recurring_class_id: data.classId,
      price_cents: data.amountCents,
      status: "active",
      paid_at: new Date().toISOString(),
      payment_method: data.paymentMethod,
      valid_from: data.validFrom,
      valid_until: data.validUntil,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return fail("Nie udało się zapisać wpłaty.");
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    actor_label: "ola",
    action: "payment.recorded",
    entity: "package",
    entity_id: inserted.id as string,
    customer_id: customerId,
    details: {
      kind: data.kind,
      amount_cents: data.amountCents,
      payment_method: data.paymentMethod,
      recurring_class_id: data.classId,
      valid_from: data.validFrom,
      valid_until: data.validUntil,
    },
  });

  revalidateGroup(data.classId);
  return { ok: true, message: "Wpłata odnotowana." };
}
