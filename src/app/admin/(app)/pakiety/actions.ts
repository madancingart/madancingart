"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { activatePackage } from "@/lib/packages/activate";
import { site } from "@/content/site";
import { z } from "zod";

export type PackageActionResult =
  | { ok: true; message?: string; lessonNo?: number; completed?: boolean }
  | { ok: false; error: string };

function fail(error: string): PackageActionResult {
  return { ok: false, error };
}

function revalidatePackages() {
  revalidatePath("/admin/pakiety");
  revalidatePath("/admin/kalendarz");
  revalidatePath("/admin/zapisy");
  revalidatePath("/grafik");
}

const markPaidSchema = z.object({
  packageId: z.uuid(),
  paymentMethod: z.enum(["onsite", "transfer"]),
});

const scheduleSchema = z.object({
  packageId: z.uuid(),
  slotId: z.uuid(),
});

const attachSchema = z.object({
  bookingId: z.uuid(),
  packageId: z.uuid(),
});

const openSlotsSchema = z.object({
  locationId: z.enum(["mikolow", "lubliniec"]).optional(),
  trainerId: z.string().trim().max(64).optional(),
});

export type OpenSlotOption = {
  id: string;
  startsAt: string;
  endsAt: string;
  locationId: string;
  locationLabel: string;
  trainerId: string | null;
};

export type CustomerPackageOption = {
  id: string;
  label: string;
  used: number;
  totalLessons: number | null;
};

export async function markPackagePaid(
  input: unknown,
): Promise<PackageActionResult> {
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawne dane.");
  }
  const { user, supabase } = await requireAdmin();
  const result = await activatePackage({
    supabase,
    packageId: parsed.data.packageId,
    paymentMethod: parsed.data.paymentMethod,
    actorId: user.id,
    actorLabel: "ola",
  });
  if (!result.ok) {
    return fail(result.error);
  }
  revalidatePackages();
  return { ok: true, message: "Pakiet oznaczony jako opłacony." };
}

export async function listOpenSlots(
  input: unknown,
): Promise<
  { ok: true; slots: OpenSlotOption[] } | { ok: false; error: string }
> {
  const parsed = openSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawny filtr terminów." };
  }
  const { supabase } = await requireAdmin();
  let query = supabase
    .from("slots")
    .select("id,location_id,starts_at,ends_at,trainer_id,status")
    .eq("status", "open")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(80);

  if (parsed.data.locationId) {
    query = query.eq("location_id", parsed.data.locationId);
  }
  if (parsed.data.trainerId) {
    query = query.eq("trainer_id", parsed.data.trainerId);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: "Nie udało się pobrać wolnych terminów." };
  }

  const slots: OpenSlotOption[] = (data ?? []).map((row) => {
    const locationId = row.location_id as string;
    const city =
      site.locations.find((item) => item.id === locationId)?.city ??
      locationId;
    return {
      id: row.id as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      locationId,
      locationLabel: city,
      trainerId: (row.trainer_id as string | null) ?? null,
    };
  });

  return { ok: true, slots };
}

export async function schedulePackageLesson(
  input: unknown,
): Promise<PackageActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawne dane.");
  }

  const { supabase } = await requireAdmin();
  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select(
      "id,status,customer_id,total_lessons,customers(first_name,last_name,partner_first_name,partner_last_name,phone,email)",
    )
    .eq("id", parsed.data.packageId)
    .maybeSingle();

  if (pkgError || !pkg) {
    return fail("Nie znaleziono pakietu.");
  }
  if (pkg.status !== "active") {
    return fail("Zaplanować lekcję można tylko z aktywnego pakietu.");
  }

  const rawCustomer = (
    pkg as {
      customers:
        | {
            first_name: string;
            last_name: string;
            partner_first_name: string | null;
            partner_last_name: string | null;
            phone: string | null;
            email: string | null;
          }
        | {
            first_name: string;
            last_name: string;
            partner_first_name: string | null;
            partner_last_name: string | null;
            phone: string | null;
            email: string | null;
          }[]
        | null;
    }
  ).customers;
  const customer = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
  if (!customer?.phone || !customer.email) {
    return fail("Klient nie ma kompletnego telefonu i e-maila.");
  }

  const { data: bookingId, error: bookError } = await supabase.rpc(
    "create_booking",
    {
      p_kind: "slot",
      p_target_id: parsed.data.slotId,
      p_first_name: customer.first_name,
      p_last_name: customer.last_name,
      p_phone: customer.phone,
      p_email: customer.email,
      p_message: null,
      p_dance_type: "Pierwszy taniec weselny",
      p_payment_option: "onsite",
      p_consent: true,
      p_partner_first_name: customer.partner_first_name,
      p_partner_last_name: customer.partner_last_name,
      p_guardian_name: null,
      p_guardian_phone: null,
      p_customer_kind: "pair",
    },
  );

  if (bookError || typeof bookingId !== "string") {
    const message = bookError?.message ?? "";
    if (message.includes("slot_unavailable")) {
      return fail("Ten termin jest już zajęty.");
    }
    return fail("Nie udało się zapisać lekcji na wybrany slot.");
  }

  await supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId);

  const { data: lessonNo, error: assignError } = await supabase.rpc(
    "assign_booking_to_package",
    {
      p_booking_id: bookingId,
      p_package_id: parsed.data.packageId,
    },
  );

  if (assignError) {
    const message = assignError.message ?? "";
    if (message.includes("package_exhausted")) {
      return fail("Pula lekcji w pakiecie jest już wyczerpana.");
    }
    return fail("Zapisano slot, ale nie udało się przypiąć go do pakietu.");
  }

  const used = typeof lessonNo === "number" ? lessonNo : Number(lessonNo);
  const total = pkg.total_lessons as number | null;
  const completed = total != null && used === total;
  revalidatePackages();
  revalidatePath(`/admin/pakiety/${parsed.data.packageId}`);
  return {
    ok: true,
    lessonNo: used,
    completed,
    message: completed
      ? "Pakiet wykorzystany — wszystkie lekcje zaplanowane."
      : `Zaplanowano lekcję ${used}${total ? `/${total}` : ""}.`,
  };
}

export async function attachBookingToPackage(
  input: unknown,
): Promise<PackageActionResult> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Niepoprawne dane.");
  }
  const { supabase } = await requireAdmin();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,customer_id,package_id,status")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  if (!booking) {
    return fail("Nie znaleziono zapisu.");
  }
  if (booking.status === "cancelled") {
    return fail("Nie można przypiąć anulowanego zapisu.");
  }
  if (booking.package_id) {
    return fail("Ten zapis jest już przypięty do pakietu.");
  }

  const { data: pkg } = await supabase
    .from("packages")
    .select("id,customer_id,status,total_lessons")
    .eq("id", parsed.data.packageId)
    .maybeSingle();

  if (!pkg || pkg.status !== "active") {
    return fail("Wybierz aktywny pakiet.");
  }
  if (booking.customer_id && booking.customer_id !== pkg.customer_id) {
    return fail("Pakiet należy do innego klienta.");
  }

  const { data: lessonNo, error } = await supabase.rpc(
    "assign_booking_to_package",
    {
      p_booking_id: parsed.data.bookingId,
      p_package_id: parsed.data.packageId,
    },
  );

  if (error) {
    if (error.message.includes("package_exhausted")) {
      return fail("Pula lekcji w pakiecie jest już wyczerpana.");
    }
    if (error.message.includes("package_not_active")) {
      return fail("Pakiet nie jest aktywny.");
    }
    return fail("Nie udało się przypiąć zapisu do pakietu.");
  }

  const used = typeof lessonNo === "number" ? lessonNo : Number(lessonNo);
  const total = pkg.total_lessons as number | null;
  const completed = total != null && used === total;
  revalidatePackages();
  return {
    ok: true,
    lessonNo: used,
    completed,
    message: completed
      ? "Pakiet wykorzystany — wszystkie lekcje zaplanowane."
      : `Przypięto jako lekcję ${used}${total ? `/${total}` : ""}.`,
  };
}

export async function listActivePackagesForCustomer(
  customerId: string,
): Promise<
  | { ok: true; packages: CustomerPackageOption[] }
  | { ok: false; error: string }
> {
  const parsed = z.uuid().safeParse(customerId);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawny klient." };
  }
  const { supabase } = await requireAdmin();
  const { data: packages, error } = await supabase
    .from("packages")
    .select("id,label,total_lessons")
    .eq("customer_id", parsed.data)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: "Nie udało się pobrać pakietów." };
  }

  const ids = (packages ?? []).map((row) => row.id as string);
  const usedByPackage = new Map<string, number>();
  if (ids.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("package_id")
      .in("package_id", ids)
      .neq("status", "cancelled");
    for (const row of bookings ?? []) {
      const id = row.package_id as string | null;
      if (!id) {
        continue;
      }
      usedByPackage.set(id, (usedByPackage.get(id) ?? 0) + 1);
    }
  }

  return {
    ok: true,
    packages: (packages ?? []).map((row) => ({
      id: row.id as string,
      label: row.label as string,
      totalLessons: (row.total_lessons as number | null) ?? null,
      used: usedByPackage.get(row.id as string) ?? 0,
    })),
  };
}
