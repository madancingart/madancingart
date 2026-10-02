"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  addCustomerToClass,
  changeChargeDueDate,
  endEnrollment,
  pauseEnrollment,
  recordChargePayment,
  sendChargeReminderNow,
  setEnrollmentPaidUntil,
  transferEnrollment,
  voidOpenCharge,
  type MoneyResult,
} from "@/lib/billing/admin-money";
import { enrollmentBillingMode, findPriceItem } from "@/content/pricing";
import { assignGroupCodes } from "@/lib/billing/group-code";
import {
  previewImportRows,
  type ImportDraft,
  type ImportPreviewRow,
} from "@/lib/billing/import-csv";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/stripe";

export type BillingActionResult = MoneyResult;

function revalidateBilling(customerId?: string) {
  revalidatePath("/admin/rozliczenia");
  revalidatePath("/admin");
  revalidatePath("/admin/kalendarz");
  revalidatePath("/admin/ewidencja");
  if (customerId) {
    revalidatePath(`/admin/klienci/${customerId}`);
  }
}

async function enrollAsAdmin(
  customerId: string,
  classId: string,
): Promise<{ enrollmentId: string; isNew: boolean } | { error: string }> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("enroll_in_class", {
    p_customer_id: customerId,
    p_class_id: classId,
  });
  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes("class_full")) {
      return { error: "Grupa jest pełna. Zwiększ pojemność albo wybierz inną." };
    }
    if (text.includes("class_closed")) {
      return { error: "Zapisy do tej grupy są zamknięte. Otwórz je na chwilę albo użyj importu." };
    }
    if (text.includes("forbidden")) {
      return { error: "Brak uprawnień do tego zapisu." };
    }
    return { error: "Nie udało się dodać do grupy." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const record = row as { enrollment_id?: unknown; is_new?: unknown } | null;
  if (!record || typeof record.enrollment_id !== "string" || typeof record.is_new !== "boolean") {
    return { error: "Nie udało się dodać do grupy." };
  }
  return { enrollmentId: record.enrollment_id, isNew: record.is_new };
}

const paymentSchema = z.object({
  chargeId: z.uuid(),
  method: z.enum(["onsite", "transfer"]),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function recordPaymentAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Sprawdź metodę i datę wpłaty." };
  }
  const result = await recordChargePayment(parsed.data);
  if (result.ok) {
    revalidateBilling();
  }
  return result;
}

export async function voidChargeAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = z.object({ chargeId: z.uuid(), reason: z.string().min(1).max(300) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj powód anulowania." };
  }
  const result = await voidOpenCharge(parsed.data);
  if (result.ok) {
    revalidateBilling();
  }
  return result;
}

export async function changeDueAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ chargeId: z.uuid(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj termin płatności." };
  }
  const result = await changeChargeDueDate(parsed.data);
  if (result.ok) {
    revalidateBilling();
  }
  return result;
}

export async function remindNowAction(chargeId: string): Promise<BillingActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(chargeId).success) {
    return { ok: false, error: "Nie znaleziono należności." };
  }
  return sendChargeReminderNow(chargeId);
}

export async function setPaidUntilAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      enrollmentId: z.uuid(),
      until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amountZloty: z.string(),
      method: z.enum(["onsite", "transfer", "legacy"]),
      note: z.string().max(300),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Sprawdź datę i kwotę." };
  }
  const amountCents = zlotyToCents(parsed.data.amountZloty);
  if (amountCents === null) {
    return { ok: false, error: "Kwota musi być liczbą. Zero, gdy nieznana." };
  }
  const result = await setEnrollmentPaidUntil({
    enrollmentId: parsed.data.enrollmentId,
    until: parsed.data.until,
    amountCents,
    method: parsed.data.method,
    note: parsed.data.note,
  });
  if (result.ok) {
    revalidateBilling();
  }
  return result;
}

export async function addToClassAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      customerId: z.uuid(),
      classId: z.uuid(),
      skipFirstPayment: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Wybierz osobę i grupę." };
  }
  const result = await addCustomerToClass({
    ...parsed.data,
    enroll: () => enrollAsAdmin(parsed.data.customerId, parsed.data.classId),
  });
  if (result.ok) {
    revalidateBilling(parsed.data.customerId);
    revalidatePath(`/admin/grupy/${parsed.data.classId}`);
  }
  return result;
}

export async function pauseEnrollmentAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      enrollmentId: z.uuid(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj daty przerwy." };
  }
  const result = await pauseEnrollment(parsed.data);
  if (result.ok) {
    revalidateBilling();
  }
  return result;
}

export async function endEnrollmentAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      enrollmentId: z.uuid(),
      endedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj datę zakończenia." };
  }
  const result = await endEnrollment(parsed.data);
  if (result.ok) {
    revalidateBilling();
  }
  return result;
}

export async function transferEnrollmentAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ enrollmentId: z.uuid(), targetClassId: z.uuid() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Wybierz grupę docelową." };
  }
  const result = await transferEnrollment({
    enrollmentId: parsed.data.enrollmentId,
    targetClassId: parsed.data.targetClassId,
    enroll: (customerId, classId) => enrollAsAdmin(customerId, classId),
  });
  if (result.ok) {
    revalidateBilling();
    revalidatePath(`/admin/grupy/${parsed.data.targetClassId}`);
  }
  return result;
}

const personSchema = z.object({
  kind: z.enum(["adult", "pair", "child"]),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  partnerFirstName: z.string(),
  partnerLastName: z.string(),
  guardianName: z.string(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(5),
  classId: z.uuid(),
  paidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountZloty: z.string(),
  method: z.enum(["onsite", "transfer", "legacy"]),
  note: z.string().max(300),
  invite: z.boolean(),
});

export async function addPaidClientAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Uzupełnij dane osoby, grupy i daty opłacenia." };
  }
  const amountCents = zlotyToCents(parsed.data.amountZloty);
  if (amountCents === null) {
    return { ok: false, error: "Kwota musi być liczbą. Zero, gdy nieznana." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("import_paid_enrollments", {
    p_rows: [
      {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        kind: parsed.data.kind,
        partner_first_name: parsed.data.partnerFirstName,
        partner_last_name: parsed.data.partnerLastName,
        guardian_name: parsed.data.guardianName,
        class_id: parsed.data.classId,
        billing_mode: await billingModeForClass(parsed.data.classId),
        paid_until: parsed.data.paidUntil,
        amount_cents: amountCents,
        method: parsed.data.method,
        note: parsed.data.note,
      },
    ],
  });
  if (error) {
    return { ok: false, error: importError(error.message) };
  }
  if (parsed.data.invite) {
    const invited = await inviteAccount(parsed.data.email);
    revalidateBilling();
    return invited.ok
      ? { ok: true, message: "Klient dodany. Zaproszenie do konta wysłane." }
      : { ok: true, message: `Klient dodany. ${invited.error}` };
  }
  revalidateBilling();
  return { ok: true, message: `Dodano ${typeof data === "number" ? data : 1} osobę.` };
}

export async function previewImportAction(
  csv: string,
): Promise<{ ok: true; rows: ImportPreviewRow[] } | { ok: false; error: string }> {
  await requireAdmin();
  const { parseImportCsv } = await import("@/lib/billing/import-csv");
  const parsed = parseImportCsv(csv);
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }
  const catalog = await groupCatalog();
  const emails = [...new Set(parsed.drafts.map((row) => row.email).filter(Boolean))];
  const admin = createAdminClient();
  const existing = new Set<string>();
  if (emails.length > 0) {
    const { data } = await admin.from("customers").select("email").in("email", emails);
    for (const row of (data ?? []) as { email: string | null }[]) {
      if (row.email) {
        existing.add(row.email.toLowerCase());
      }
    }
  }
  const enrolled = new Set<string>();
  const rows = previewImportRows({
    drafts: parsed.drafts,
    groups: catalog.byCode,
    emailsInUse: existing,
    enrolledKeys: enrolled,
  });
  const linkedEmails = rows
    .filter((row) => row.status !== "error" && row.draft)
    .map((row) => row.draft?.email ?? "");
  if (linkedEmails.length > 0) {
    const { data: customers } = await admin
      .from("customers")
      .select("id, email")
      .in("email", linkedEmails);
    const idByEmail = new Map(
      ((customers ?? []) as { id: string; email: string | null }[])
        .filter((row) => row.email)
        .map((row) => [row.email!.toLowerCase(), row.id]),
    );
    const ids = [...idByEmail.values()];
    if (ids.length > 0) {
      const { data: openRows } = await admin
        .from("enrollments")
        .select("customer_id, recurring_class_id")
        .in("customer_id", ids)
        .in("status", ["pending", "active", "paused"]);
      const open = new Set(
        ((openRows ?? []) as { customer_id: string; recurring_class_id: string }[]).map(
          (row) => `${row.customer_id}|${row.recurring_class_id}`,
        ),
      );
      for (const row of rows) {
        const draft = row.draft;
        const group = draft ? catalog.byCode.get(draft.groupCode) : undefined;
        const customerId = draft ? idByEmail.get(draft.email) : undefined;
        if (draft && group && customerId && open.has(`${customerId}|${group.id}`)) {
          row.status = "error";
          row.message = "ta osoba jest już w tej grupie";
        }
      }
    }
  }
  return { ok: true, rows };
}

export async function commitImportAction(
  drafts: ImportDraft[],
): Promise<BillingActionResult> {
  await requireAdmin();
  if (drafts.length === 0) {
    return { ok: false, error: "Nie ma wierszy do importu." };
  }
  const catalog = await groupCatalog();
  const payload = [];
  for (const draft of drafts) {
    const group = catalog.byCode.get(draft.groupCode);
    if (!group) {
      return { ok: false, error: `Wiersz ${draft.line}: nieznany kod grupy.` };
    }
    payload.push({
      first_name: draft.firstName,
      last_name: draft.lastName,
      phone: draft.phone,
      email: draft.email,
      kind: draft.kind,
      partner_first_name: draft.partnerFirstName,
      partner_last_name: draft.partnerLastName,
      guardian_name: draft.guardianName,
      class_id: group.id,
      billing_mode: group.billingMode,
      paid_until: draft.paidUntil,
      amount_cents: draft.amountCents,
      method: draft.method,
      note: draft.note,
    });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("import_paid_enrollments", { p_rows: payload });
  if (error) {
    return { ok: false, error: importError(error.message) };
  }
  revalidateBilling();
  return { ok: true, message: `Zaimportowano ${typeof data === "number" ? data : payload.length} wierszy.` };
}

export async function inviteCustomerAction(input: unknown): Promise<BillingActionResult> {
  await requireAdmin();
  const parsed = z.object({ email: z.string().email() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Brak adresu e-mail na kartotece." };
  }
  return inviteAccount(parsed.data.email);
}

export async function searchPeopleAction(
  query: string,
): Promise<{ id: string; label: string }[]> {
  await requireAdmin();
  const safe = query.trim().replace(/[%_,()]/g, "");
  if (safe.length < 2) {
    return [];
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id, first_name, last_name, email, phone")
    .or(
      `last_name.ilike.%${safe}%,first_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`,
    )
    .limit(8);
  return ((data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  }[]).map((row) => ({
    id: row.id,
    label: `${row.first_name} ${row.last_name}${row.email ? ` · ${row.email}` : ""}`,
  }));
}

async function billingModeForClass(classId: string): Promise<"monthly" | "pass4"> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("recurring_classes")
    .select("price_item_id")
    .eq("id", classId)
    .maybeSingle();
  const priceId = (data as { price_item_id: string | null } | null)?.price_item_id;
  const item = priceId ? findPriceItem(priceId) : null;
  return (item && enrollmentBillingMode(item)) || "monthly";
}

async function groupCatalog(): Promise<{
  byCode: Map<string, { id: string; billingMode: "monthly" | "pass4" }>;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("recurring_classes")
    .select("id, location_id, weekday, start_time, price_item_id, class_types(slug)")
    .eq("active", true);
  const rows = (data ?? []) as {
    id: string;
    location_id: string;
    weekday: number;
    start_time: string;
    price_item_id: string | null;
    class_types: { slug: string } | { slug: string }[] | null;
  }[];
  const codes = assignGroupCodes(
    rows.map((row) => {
      const type = Array.isArray(row.class_types) ? row.class_types[0] : row.class_types;
      return {
        id: row.id,
        locationId: row.location_id,
        weekday: row.weekday,
        startTime: row.start_time,
        slug: type?.slug ?? "grupa",
      };
    }),
  );
  const byCode = new Map<string, { id: string; billingMode: "monthly" | "pass4" }>();
  for (const row of rows) {
    const code = codes.get(row.id);
    const item = row.price_item_id ? findPriceItem(row.price_item_id) : null;
    if (code) {
      byCode.set(code, {
        id: row.id,
        billingMode: (item && enrollmentBillingMode(item)) || "monthly",
      });
    }
  }
  return { byCode };
}

async function inviteAccount(email: string): Promise<BillingActionResult> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback`,
  });
  if (error) {
    return { ok: false, error: "Nie wysłano zaproszenia. Konto z tym adresem może już istnieć." };
  }
  return { ok: true, message: "Zaproszenie wysłane." };
}

function importError(message: string): string {
  if (message.includes("already_enrolled")) {
    return "Ktoś z pliku jest już w tej grupie. Nic nie zostało zapisane.";
  }
  return "Import się nie udał. Nic nie zostało zapisane.";
}

function zlotyToCents(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) {
    return 0;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0"), 10);
}

export async function listMoveTargets(exceptClassId: string): Promise<{ id: string; label: string }[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("recurring_classes")
    .select("id, location_id, weekday, start_time, class_types(name)")
    .eq("active", true)
    .neq("id", exceptClassId)
    .order("weekday");
  return ((data ?? []) as {
    id: string;
    location_id: string;
    weekday: number;
    start_time: string;
    class_types: { name: string } | { name: string }[] | null;
  }[]).map((row) => {
    const type = Array.isArray(row.class_types) ? row.class_types[0] : row.class_types;
    return {
      id: row.id,
      label: `${row.location_id === "lubliniec" ? "Lubliniec" : "Mikołów"} · ${row.start_time.slice(0, 5)} · ${type?.name ?? "Zajęcia"}`,
    };
  });
}
