"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { slugifyPriceId } from "@/lib/pricing/db";

export type PriceActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

const unitSchema = z.enum(["os/mies", "para/mies", "os", "para", "h", "pakiet"]);
const billingSchema = z.enum(["monthly", "pass4", "one-off"]);

const priceFormSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  locationId: z.enum(["mikolow", "lubliniec"]),
  section: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  detail: z
    .string()
    .trim()
    .max(80)
    .transform((value) => (value.length === 0 ? null : value)),
  amountZl: z.coerce.number().min(0).max(100_000),
  unit: unitSchema,
  note: z
    .string()
    .trim()
    .max(160)
    .transform((value) => (value.length === 0 ? null : value)),
  billing: billingSchema,
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  active: z.boolean(),
});

function fail(error: string): PriceActionResult {
  return { ok: false, error };
}

function revalidatePricing() {
  revalidatePath("/admin/cennik");
  revalidatePath("/cennik");
  revalidatePath("/admin/kalendarz");
  revalidatePath("/admin");
}

export async function savePriceItem(input: unknown): Promise<PriceActionResult> {
  const parsed = priceFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Sprawdź formularz cennika.");
  }

  const { supabase } = await requireAdmin();
  const amountCents = Math.round(parsed.data.amountZl * 100);
  const id =
    parsed.data.id?.trim() ||
    slugifyPriceId(
      `${parsed.data.locationId}-${parsed.data.section}-${parsed.data.label}-${parsed.data.detail ?? ""}`,
    );

  if (!id) {
    return fail("Nie udało się utworzyć identyfikatora pozycji.");
  }

  const row = {
    id,
    location_id: parsed.data.locationId,
    section: parsed.data.section,
    label: parsed.data.label,
    detail: parsed.data.detail,
    amount_cents: amountCents,
    unit: parsed.data.unit,
    note: parsed.data.note,
    billing: parsed.data.billing,
    sort_order: parsed.data.sortOrder,
    active: parsed.data.active,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("price_items").upsert(row, { onConflict: "id" });
  if (error) {
    return fail("Nie udało się zapisać pozycji cennika.");
  }

  revalidatePricing();
  return { ok: true, id, message: "Zapisano pozycję cennika." };
}

export async function setPriceItemActive(input: unknown): Promise<PriceActionResult> {
  const parsed = z
    .object({ id: z.string().min(1).max(80), active: z.boolean() })
    .safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawna pozycja.");
  }
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("price_items")
    .update({ active: parsed.data.active, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) {
    return fail("Nie udało się zmienić statusu pozycji.");
  }
  revalidatePricing();
  return {
    ok: true,
    message: parsed.data.active ? "Pozycja aktywna." : "Pozycja ukryta.",
  };
}

export async function deletePriceItem(input: unknown): Promise<PriceActionResult> {
  const parsed = z.object({ id: z.string().min(1).max(80) }).safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawna pozycja.");
  }
  const { supabase } = await requireAdmin();
  const { count } = await supabase
    .from("recurring_classes")
    .select("id", { count: "exact", head: true })
    .eq("price_item_id", parsed.data.id)
    .eq("active", true);
  if ((count ?? 0) > 0) {
    return fail("Pozycja jest używana przez aktywne grupy — najpierw ją wyłącz albo odłącz.");
  }
  const { error } = await supabase.from("price_items").delete().eq("id", parsed.data.id);
  if (error) {
    return fail("Nie udało się usunąć. Możesz ją ukryć zamiast kasować.");
  }
  revalidatePricing();
  return { ok: true, message: "Usunięto pozycję." };
}
