import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createBookingCheckout } from "@/lib/booking/checkout";
import { mapBookingError } from "@/lib/booking/errors";
import { releaseUnpaidBooking } from "@/lib/booking/release";
import { resolveBookingTerm } from "@/lib/booking/term";
import { sendBookingEmails } from "@/lib/email";
import { allowBookingAttempt, clientIp } from "@/lib/rate-limit";
import { hasStripeSecret } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { CustomerKind } from "@/lib/types";
import {
  bookingApiSchema,
  coercePaymentOption,
  customerKindFromClass,
  guardianDisplayName,
} from "@/lib/validation";

type ClassTypeEmbed = {
  slug: string;
  is_pair: boolean;
};

async function expectedClassCustomerKind(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
): Promise<CustomerKind | null> {
  const { data, error } = await supabase
    .from("recurring_classes")
    .select("class_types ( slug, is_pair )")
    .eq("id", classId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const raw = (data as { class_types: ClassTypeEmbed | ClassTypeEmbed[] | null })
    .class_types;
  const type = Array.isArray(raw) ? raw[0] : raw;
  if (!type) {
    return null;
  }
  return customerKindFromClass({ slug: type.slug, isPair: type.is_pair });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Niepoprawne dane formularza." },
      { status: 400 },
    );
  }

  const parsed = bookingApiSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      {
        ok: false,
        error: first?.message ?? "Sprawdź dane w formularzu.",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if (data.website?.trim()) {
    return Response.json(
      { ok: false, error: "Nie udało się wysłać zapisu." },
      { status: 400 },
    );
  }

  if (!allowBookingAttempt(clientIp(request))) {
    return Response.json(
      {
        ok: false,
        error:
          "Zbyt wiele prób zapisu. Spróbuj ponownie za kilka minut.",
      },
      { status: 429 },
    );
  }

  const paymentOption = coercePaymentOption(data.paymentOption);
  const supabase = await createClient();

  if (data.kind === "class") {
    const expected = await expectedClassCustomerKind(supabase, data.targetId);
    if (!expected || expected !== data.customerKind) {
      return Response.json(
        { ok: false, error: "Sprawdź dane osób zapisanych na ten typ zajęć." },
        { status: 400 },
      );
    }
  }

  const partnerFirstName =
    data.customerKind === "pair" ? data.partnerFirstName : null;
  const partnerLastName =
    data.customerKind === "pair" ? data.partnerLastName : null;
  const guardianName =
    data.customerKind === "child"
      ? guardianDisplayName(data.guardianFirstName, data.guardianLastName)
      : null;
  const guardianPhone = data.customerKind === "child" ? data.phone : null;

  const { data: bookingId, error } = await supabase.rpc("create_booking", {
    p_kind: data.kind,
    p_target_id: data.targetId,
    p_first_name: data.firstName,
    p_last_name: data.lastName,
    p_phone: data.phone,
    p_email: data.email,
    p_message: data.message.length > 0 ? data.message : null,
    p_dance_type: data.kind === "slot" ? (data.danceType ?? null) : null,
    p_payment_option: paymentOption,
    p_consent: data.consentRodo,
    p_partner_first_name: partnerFirstName,
    p_partner_last_name: partnerLastName,
    p_guardian_name: guardianName,
    p_guardian_phone: guardianPhone,
    p_customer_kind: data.customerKind,
  });

  if (error) {
    const mapped = mapBookingError(error.message);
    return Response.json(
      { ok: false, error: mapped.message },
      { status: mapped.status },
    );
  }

  if (typeof bookingId !== "string") {
    return Response.json(
      { ok: false, error: "Nie udało się zapisać. Spróbuj ponownie za chwilę." },
      { status: 500 },
    );
  }

  revalidatePath("/grafik");

  if (paymentOption !== "onsite") {
    if (!hasStripeSecret()) {
      await releaseUnpaidBooking(bookingId);
      return Response.json(
        {
          ok: false,
          error: "Płatności online są chwilowo niedostępne.",
        },
        { status: 503 },
      );
    }

    const checkout = await createBookingCheckout({
      bookingId,
      input: { ...data, paymentOption },
    });

    if ("error" in checkout) {
      return Response.json(
        { ok: false, error: checkout.error },
        { status: checkout.status },
      );
    }

    return Response.json({
      ok: true,
      bookingId,
      checkoutUrl: checkout.url,
    });
  }

  const term = await resolveBookingTerm(supabase, {
    kind: data.kind,
    targetId: data.targetId,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    fallbackTitle:
      data.kind === "slot" ? "Lekcja indywidualna" : data.title,
    fallbackLocationId: data.locationId,
  });

  after(() =>
    sendBookingEmails({
      kind: data.kind,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      message: data.message,
      danceType: data.kind === "slot" ? (data.danceType ?? null) : null,
      customerKind: data.customerKind,
      partnerFirstName,
      partnerLastName,
      guardianName,
      term,
    }).catch((reason: unknown) => {
      console.error("Wysyłka maili po zapisie nie powiodła się.", reason);
    }),
  );

  return Response.json({ ok: true, bookingId });
}
