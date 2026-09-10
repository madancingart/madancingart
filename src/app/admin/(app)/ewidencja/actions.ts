"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getOrCreateClassSession } from "@/lib/admin/get-journal";
import { loadGroupPassData } from "@/lib/admin/load-group-passes";
import {
  hasCoveringMonthly,
  journalPassState,
  pickEntryPassToConsume,
  type ConsumablePass,
} from "@/lib/attendance-pass";
import { isIsoDate } from "@/lib/admin/class-dates";
import { normalizePhone } from "@/lib/validation";
import type { PackageKind, PackageStatus } from "@/lib/types";

export type AttendanceActionResult =
  | {
      ok: true;
      present: boolean;
      unpaid: boolean;
      remainingLabel: string | null;
      customerId: string;
    }
  | { ok: false; error: string };

export type SearchCustomerRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
};

function fail(error: string): AttendanceActionResult {
  return { ok: false, error };
}

const isoDate = z
  .string()
  .refine(isIsoDate, "Podaj datę.");

const toggleSchema = z
  .object({
    sessionId: z.uuid(),
    classId: z.uuid(),
    sessionDate: isoDate,
    present: z.boolean(),
    customerId: z.uuid().optional(),
    bookingId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.customerId && !value.bookingId) {
      ctx.addIssue({
        code: "custom",
        message: "Brak klienta.",
      });
    }
  });

function revalidateJournal(classId: string) {
  revalidatePath("/admin/ewidencja");
  revalidatePath("/admin/ewidencja/raport");
  revalidatePath("/admin/kalendarz");
  revalidatePath("/admin/zapisy");
  revalidatePath("/admin/pakiety");
  revalidatePath(`/admin/grupy/${classId}`);
}

function toConsumable(
  packages: {
    id: string;
    customer_id: string;
    recurring_class_id: string | null;
    kind: PackageKind;
    status: PackageStatus;
    valid_from: string | null;
    valid_until: string | null;
    total_lessons: number | null;
  }[],
  usedByPackageId: Map<string, number>,
  classId: string,
  customerId: string,
): ConsumablePass[] {
  return packages
    .filter(
      (pkg) =>
        pkg.customer_id === customerId && pkg.recurring_class_id === classId,
    )
    .map((pkg) => ({
      id: pkg.id,
      kind: pkg.kind,
      status: pkg.status,
      validFrom: pkg.valid_from,
      validUntil: pkg.valid_until,
      totalLessons: pkg.total_lessons,
      usedEntries: usedByPackageId.get(pkg.id) ?? 0,
    }));
}

async function ensureCustomerFromBooking(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  bookingId: string,
  classId: string,
): Promise<{ customerId: string } | { error: string }> {
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id,recurring_class_id,customer_id,first_name,last_name,phone,email,status",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking || booking.status === "cancelled") {
    return { error: "Nie znaleziono zapisu." };
  }
  if (booking.recurring_class_id !== classId) {
    return { error: "Zapis nie należy do tej grupy." };
  }
  if (booking.customer_id) {
    return { customerId: booking.customer_id as string };
  }
  if (!booking.first_name) {
    return { error: "Brak imienia klienta — nie można odnotować obecności." };
  }

  const { data: created, error: createError } = await supabase
    .from("customers")
    .insert({
      kind: "adult",
      first_name: booking.first_name,
      last_name: booking.last_name ?? "",
      phone: booking.phone,
      email: booking.email,
    })
    .select("id")
    .single();

  if (createError || !created) {
    return { error: "Nie udało się powiązać klienta." };
  }

  const customerId = created.id as string;
  await supabase
    .from("bookings")
    .update({ customer_id: customerId })
    .eq("id", booking.id);

  return { customerId };
}

export async function toggleAttendance(
  input: unknown,
): Promise<AttendanceActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Nie udało się zapisać.");
  }

  const { supabase } = await requireAdmin();
  const data = parsed.data;

  const { data: session } = await supabase
    .from("class_sessions")
    .select("id,recurring_class_id,session_date,status")
    .eq("id", data.sessionId)
    .maybeSingle();

  if (!session || session.recurring_class_id !== data.classId) {
    return fail("Nie znaleziono zajęć.");
  }
  if (session.status === "cancelled") {
    return fail("Te zajęcia są odwołane.");
  }

  let customerId = data.customerId ?? null;
  if (!customerId && data.bookingId) {
    const ensured = await ensureCustomerFromBooking(
      supabase,
      data.bookingId,
      data.classId,
    );
    if ("error" in ensured) {
      return fail(ensured.error);
    }
    customerId = ensured.customerId;
  }
  if (!customerId) {
    return fail("Brak klienta.");
  }

  const { data: existing } = await supabase
    .from("attendance")
    .select("id,present,package_id")
    .eq("class_session_id", data.sessionId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const { packages, usedByPackageId } = await loadGroupPassData(supabase, [
    customerId,
  ]);

  if (existing?.present && existing.package_id) {
    usedByPackageId.set(
      existing.package_id,
      Math.max(0, (usedByPackageId.get(existing.package_id) ?? 0) - 1),
    );
  }

  const consumable = toConsumable(
    packages,
    usedByPackageId,
    data.classId,
    customerId,
  );

  let packageId: string | null = null;
  if (data.present) {
    if (hasCoveringMonthly(consumable, data.sessionDate)) {
      packageId = null;
    } else if (existing?.present && existing.package_id) {
      packageId = existing.package_id as string;
    } else {
      packageId = pickEntryPassToConsume(consumable, data.sessionDate)?.id ?? null;
    }
  }

  const { error: upsertError } = await supabase.from("attendance").upsert(
    {
      class_session_id: data.sessionId,
      customer_id: customerId,
      present: data.present,
      package_id: packageId,
    },
    { onConflict: "class_session_id,customer_id" },
  );

  if (upsertError) {
    return fail("Nie udało się zapisać obecności.");
  }

  const after = await loadGroupPassData(supabase, [customerId]);
  const state = journalPassState({
    present: data.present,
    packageId,
    packages: toConsumable(
      after.packages,
      after.usedByPackageId,
      data.classId,
      customerId,
    ),
    sessionDateIso: data.sessionDate,
  });

  revalidateJournal(data.classId);
  return {
    ok: true,
    present: data.present,
    unpaid: state.unpaid,
    remainingLabel: state.remainingLabel,
    customerId,
  };
}

export async function searchCustomers(
  query: string,
): Promise<{ ok: true; rows: SearchCustomerRow[] } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  const cleaned = query
    .trim()
    .replace(/[^\p{L}\p{N}\s+-]/gu, "")
    .slice(0, 80);
  if (cleaned.length < 2) {
    return { ok: true, rows: [] };
  }

  const digits = cleaned.replace(/\D/g, "");
  const pattern = `%${cleaned}%`;
  const filters = [
    `last_name.ilike.${pattern}`,
    `first_name.ilike.${pattern}`,
    `email.ilike.${pattern}`,
  ];
  if (digits.length >= 3) {
    filters.push(`phone.ilike.%${digits}%`);
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id,first_name,last_name,phone,email")
    .or(filters.join(","))
    .order("last_name", { ascending: true })
    .limit(8);

  if (error) {
    return { ok: false, error: "Nie udało się wyszukać klientów." };
  }

  return {
    ok: true,
    rows: (data ?? []).map((row) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      phone: (row.phone as string | null) ?? null,
      email: (row.email as string | null) ?? null,
    })),
  };
}

const dropInExistingSchema = z.object({
  sessionId: z.uuid(),
  classId: z.uuid(),
  sessionDate: isoDate,
  customerId: z.uuid(),
});

const dropInNewSchema = z.object({
  sessionId: z.uuid(),
  classId: z.uuid(),
  sessionDate: isoDate,
  firstName: z.string().trim().min(2, "Podaj imię."),
  lastName: z.string().trim().min(2, "Podaj nazwisko."),
  phone: z
    .string()
    .trim()
    .min(1, "Podaj numer telefonu.")
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 9 && digits.length <= 15;
    }, "Podaj numer telefonu (9–15 cyfr).")
    .transform(normalizePhone),
  email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.email({ error: "Podaj poprawny e-mail." }).optional()),
});

async function insertDropInAttendance(input: {
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  userId: string;
  sessionId: string;
  classId: string;
  sessionDate: string;
  customerId: string;
}): Promise<AttendanceActionResult> {
  const { data: session } = await input.supabase
    .from("class_sessions")
    .select("id,recurring_class_id,status")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session || session.recurring_class_id !== input.classId) {
    return fail("Nie znaleziono zajęć.");
  }
  if (session.status === "cancelled") {
    return fail("Te zajęcia są odwołane.");
  }

  const { packages, usedByPackageId } = await loadGroupPassData(
    input.supabase,
    [input.customerId],
  );
  const consumable = toConsumable(
    packages,
    usedByPackageId,
    input.classId,
    input.customerId,
  );

  let packageId: string | null = null;
  if (!hasCoveringMonthly(consumable, input.sessionDate)) {
    packageId = pickEntryPassToConsume(consumable, input.sessionDate)?.id ?? null;
  }

  const { data: upserted, error } = await input.supabase
    .from("attendance")
    .upsert(
      {
        class_session_id: input.sessionId,
        customer_id: input.customerId,
        present: true,
        package_id: packageId,
      },
      { onConflict: "class_session_id,customer_id" },
    )
    .select("id")
    .single();

  if (error) {
    return fail("Nie udało się dopisać osoby.");
  }

  await input.supabase.from("audit_log").insert({
    actor_id: input.userId,
    actor_label: "ola",
    action: "attendance.drop_in",
    entity: "attendance",
    entity_id: (upserted?.id as string | undefined) ?? null,
    customer_id: input.customerId,
    details: {
      drop_in: true,
      class_session_id: input.sessionId,
      recurring_class_id: input.classId,
      session_date: input.sessionDate,
    },
  });

  const after = await loadGroupPassData(input.supabase, [input.customerId]);
  const state = journalPassState({
    present: true,
    packageId,
    packages: toConsumable(
      after.packages,
      after.usedByPackageId,
      input.classId,
      input.customerId,
    ),
    sessionDateIso: input.sessionDate,
  });

  revalidateJournal(input.classId);
  return {
    ok: true,
    present: true,
    unpaid: state.unpaid,
    remainingLabel: state.remainingLabel,
    customerId: input.customerId,
  };
}

export async function addDropInExisting(
  input: unknown,
): Promise<AttendanceActionResult> {
  const parsed = dropInExistingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Sprawdź dane.");
  }
  const { user, supabase } = await requireAdmin();
  return insertDropInAttendance({
    supabase,
    userId: user.id,
    ...parsed.data,
  });
}

export async function addDropInNew(
  input: unknown,
): Promise<AttendanceActionResult> {
  const parsed = dropInNewSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Sprawdź formularz.");
  }
  const { user, supabase } = await requireAdmin();
  const data = parsed.data;

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      kind: "adult",
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      email: data.email ? data.email : null,
    })
    .select("id")
    .single();

  if (error || !created) {
    return fail("Nie udało się dodać klienta.");
  }

  return insertDropInAttendance({
    supabase,
    userId: user.id,
    sessionId: data.sessionId,
    classId: data.classId,
    sessionDate: data.sessionDate,
    customerId: created.id as string,
  });
}

const cancelSchema = z.object({
  classId: z.uuid(),
  sessionDate: isoDate,
  reason: z.string().trim().min(3, "Podaj powód odwołania."),
});

export async function cancelClassSession(
  input: unknown,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Sprawdź powód." };
  }
  const { user, supabase } = await requireAdmin();
  const session = await getOrCreateClassSession(
    supabase,
    parsed.data.classId,
    parsed.data.sessionDate,
  );
  if (!session) {
    return { ok: false, error: "Nie udało się odwołać zajęć." };
  }
  if (session.status === "cancelled") {
    return { ok: false, error: "Te zajęcia są już odwołane." };
  }

  const { error } = await supabase
    .from("class_sessions")
    .update({
      status: "cancelled",
      note: parsed.data.reason,
    })
    .eq("id", session.id);

  if (error) {
    return { ok: false, error: "Nie udało się odwołać zajęć." };
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    actor_label: "ola",
    action: "class_session.cancelled",
    entity: "class_session",
    entity_id: session.id,
    details: {
      reason: parsed.data.reason,
      session_date: parsed.data.sessionDate,
      recurring_class_id: parsed.data.classId,
    },
  });

  revalidateJournal(parsed.data.classId);
  revalidatePath("/grafik");
  revalidatePath("/");
  return { ok: true, message: "Zajęcia odwołane." };
}
