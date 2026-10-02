import "server-only";

import { revalidatePath } from "next/cache";
import { warsawNow } from "@/lib/billing/dates";
import { createCheckout } from "@/lib/billing/checkout";
import { createSeriesCharge } from "@/lib/billing/repo";
import { sendCourseWaitlistEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SeriesEnrollResult =
  | { ok: true; checkoutUrl: string }
  | { ok: true; message: string }
  | { ok: false; error: string; waitlist?: boolean };

export async function enrollInSeries(input: {
  customerId: string;
  slug: string;
}): Promise<SeriesEnrollResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Zaloguj się, żeby zapisać się na kurs." };
  }

  const admin = createAdminClient();
  const { data: series } = await admin
    .from("event_series")
    .select("id, title, price_cents, published, signup_open")
    .eq("slug", input.slug)
    .maybeSingle();
  const course = series as {
    id: string;
    title: string;
    price_cents: number;
    published: boolean;
    signup_open: boolean;
  } | null;
  if (!course || !course.published) {
    return { ok: false, error: "Ten kurs nie jest otwarty." };
  }

  const { count } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("series_id", course.id)
    .is("cancelled_at", null);

  const { data, error } = await supabase.rpc("enroll_in_series", {
    p_customer_id: input.customerId,
    p_series_id: course.id,
  });
  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes("series_full")) {
      return {
        ok: false,
        waitlist: true,
        error: "Brak miejsc — zostaw kontakt, damy znać, jeśli ktoś zrezygnuje.",
      };
    }
    if (text.includes("series_closed")) {
      return { ok: false, error: "Zapisy na ten kurs są zamknięte." };
    }
    if (text.includes("forbidden")) {
      return { ok: false, error: "Możesz zapisać tylko swojego uczestnika." };
    }
    return { ok: false, error: "Nie udało się zapisać na kurs." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const record = row as { booking_id?: unknown; is_new?: unknown } | null;
  if (!record || typeof record.booking_id !== "string") {
    return { ok: false, error: "Nie udało się zapisać na kurs." };
  }

  const existing = await admin
    .from("charges")
    .select("id, status")
    .eq("series_booking_id", record.booking_id)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const charge = existing.data as { id: string; status: "open" | "paid" | "void" } | null;

  if (!record.is_new && charge?.status === "paid") {
    return { ok: true, message: "Ta osoba jest już zapisana i opłacona." };
  }
  if (!record.is_new && charge?.status === "open") {
    return openSeriesCheckout(charge.id);
  }

  const created = await createSeriesCharge({
    customerId: input.customerId,
    seriesBookingId: record.booking_id,
    amountCents: course.price_cents,
    label: course.title,
    dueDate: warsawNow().date,
    sessionsCount: count ?? 0,
  });
  revalidatePath("/konto");
  if (created.status === "paid") {
    return { ok: true, message: "Ta osoba jest już zapisana i opłacona." };
  }
  return openSeriesCheckout(created.id);
}

async function openSeriesCheckout(
  chargeId: string,
): Promise<SeriesEnrollResult> {
  try {
    const checkout = await createCheckout([chargeId]);
    return { ok: true, checkoutUrl: checkout.url };
  } catch {
    return {
      ok: false,
      error: "Zapis jest przyjęty, ale nie udało się otworzyć płatności. Spróbuj ponownie z konta.",
    };
  }
}

export async function joinCourseWaitlist(input: {
  slug: string;
  name: string;
  email: string;
  phone: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("event_series")
    .select("title")
    .eq("slug", input.slug)
    .eq("published", true)
    .maybeSingle();
  const title = (data as { title: string } | null)?.title;
  if (!title) {
    return { ok: false, error: "Nie znaleziono kursu." };
  }
  const sent = await sendCourseWaitlistEmail({
    title,
    name: input.name,
    email: input.email,
    phone: input.phone,
  });
  if (!sent) {
    return { ok: false, error: "Nie udało się wysłać zgłoszenia. Zadzwoń do szkoły." };
  }
  return { ok: true };
}
