"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { normalizePhone } from "@/lib/validation";

export type CustomerActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function fail(error: string): CustomerActionResult {
  return { ok: false, error };
}

function revalidateCustomer(customerId: string) {
  revalidatePath("/admin/klienci");
  revalidatePath(`/admin/klienci/${customerId}`);
  revalidatePath("/admin/kalendarz");
  revalidatePath("/admin/zapisy");
  revalidatePath("/admin/ewidencja");
  revalidatePath("/admin/pakiety");
}

const optionalText = z.string().trim().max(200);
const notesSchema = z.string().max(4000);

const updateSchema = z.object({
  customerId: z.uuid(),
  kind: z.enum(["adult", "pair", "child"]),
  firstName: z.string().trim().min(1, "Podaj imię.").max(80),
  lastName: z.string().trim().max(80),
  partnerFirstName: optionalText.optional(),
  partnerLastName: optionalText.optional(),
  guardianName: optionalText.optional(),
  guardianPhone: optionalText.optional(),
  phone: optionalText.optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Podaj poprawny e-mail.",
    )
    .optional(),
});

const notesUpdateSchema = z.object({
  customerId: z.uuid(),
  notes: notesSchema,
});

const idSchema = z.object({
  customerId: z.uuid(),
});

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function phoneOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9) {
    return trimmed;
  }
  return normalizePhone(trimmed);
}

export async function updateCustomer(input: unknown): Promise<CustomerActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Sprawdź dane.");
  }

  const data = parsed.data;
  if (data.kind === "pair") {
    if (!data.partnerFirstName?.trim() || !data.partnerLastName?.trim()) {
      return fail("Dla pary podaj imię i nazwisko drugiej osoby.");
    }
  }
  if (data.kind === "child" && !data.guardianName?.trim()) {
    return fail("Dla dziecka podaj imię opiekuna.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("customers")
    .update({
      kind: data.kind,
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      partner_first_name:
        data.kind === "pair" ? emptyToNull(data.partnerFirstName) : null,
      partner_last_name:
        data.kind === "pair" ? emptyToNull(data.partnerLastName) : null,
      guardian_name: data.kind === "child" ? emptyToNull(data.guardianName) : null,
      guardian_phone:
        data.kind === "child" ? phoneOrNull(data.guardianPhone) : null,
      phone: phoneOrNull(data.phone),
      email: emptyToNull(data.email)?.toLowerCase() ?? null,
    })
    .eq("id", data.customerId);

  if (error) {
    return fail("Nie udało się zapisać danych.");
  }

  revalidateCustomer(data.customerId);
  return { ok: true, message: "Zapisano dane." };
}

export async function updateCustomerNotes(
  input: unknown,
): Promise<CustomerActionResult> {
  const parsed = notesUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Nie udało się zapisać notatki.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("customers")
    .update({ notes: emptyToNull(parsed.data.notes) })
    .eq("id", parsed.data.customerId);

  if (error) {
    return fail("Nie udało się zapisać notatki.");
  }

  revalidateCustomer(parsed.data.customerId);
  return { ok: true };
}

export async function anonymizeCustomer(
  input: unknown,
): Promise<CustomerActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawny identyfikator klienta.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_anonymize_customer", {
    p_customer_id: parsed.data.customerId,
  });

  if (error) {
    if (error.message.includes("customer_not_found")) {
      return fail("Nie znaleziono klienta.");
    }
    return fail("Nie udało się usunąć danych.");
  }

  revalidateCustomer(parsed.data.customerId);
  return { ok: true, message: "Dane klienta zostały usunięte." };
}
