import "server-only";

import { differenceInMinutes } from "date-fns";
import type { BookingApiInput } from "@/lib/validation";
import { quoteBookingCharge, type ChargeQuote } from "@/lib/booking/price";
import { releaseUnpaidBooking } from "@/lib/booking/release";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, integrationIdentifier, siteUrl } from "@/lib/stripe";
import type { LocationId } from "@/lib/types";

type ClassChargeEmbed = {
  slug: string;
};

export async function createBookingCheckout(params: {
  bookingId: string;
  input: BookingApiInput;
}): Promise<{ url: string } | { error: string; status: number }> {
  const quote = await resolveQuote(params.input);
  if (!quote) {
    await releaseUnpaidBooking(params.bookingId);
    return {
      error:
        params.input.kind === "event"
          ? "Dla wydarzeń dostępna jest opłata rezerwacyjna albo płatność na miejscu."
          : "Nie udało się ustalić kwoty. Wybierz płatność na miejscu albo opłatę rezerwacyjną.",
      status: 400,
    };
  }

  const admin = createAdminClient();
  const { error: amountError } = await admin
    .from("bookings")
    .update({ amount_cents: quote.amountCents })
    .eq("id", params.bookingId);

  if (amountError) {
    await releaseUnpaidBooking(params.bookingId);
    return {
      error: "Nie udało się przygotować płatności. Spróbuj ponownie.",
      status: 500,
    };
  }

  const origin = siteUrl();
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        locale: "pl",
        customer_email: params.input.email,
        client_reference_id: params.bookingId,
        integration_identifier: integrationIdentifier("madancingart-booking"),
        success_url: `${origin}/zapis/sukces?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/zapis/anulowano`,
        expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
        metadata: {
          booking_id: params.bookingId,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "pln",
              unit_amount: quote.amountCents,
              product_data: {
                name: quote.productName,
                description: quote.productDescription,
              },
            },
          },
        ],
      },
      { idempotencyKey: `booking-checkout-${params.bookingId}` },
    );

    if (!session.url) {
      await releaseUnpaidBooking(params.bookingId);
      return {
        error: "Nie udało się otworzyć płatności Stripe. Spróbuj ponownie.",
        status: 500,
      };
    }

    const { error: sessionError } = await admin
      .from("bookings")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", params.bookingId);

    if (sessionError) {
      await releaseUnpaidBooking(params.bookingId);
      return {
        error: "Nie udało się zapisać sesji płatności. Spróbuj ponownie.",
        status: 500,
      };
    }

    return { url: session.url };
  } catch {
    await releaseUnpaidBooking(params.bookingId);
    return {
      error: "Nie udało się otworzyć płatności Stripe. Spróbuj ponownie.",
      status: 502,
    };
  }
}

async function resolveQuote(input: BookingApiInput): Promise<ChargeQuote | null> {
  const durationMin = Math.max(
    1,
    differenceInMinutes(new Date(input.endsAt), new Date(input.startsAt)),
  );

  if (input.kind === "class") {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("recurring_classes")
      .select("duration_min,location_id,class_types ( slug )")
      .eq("id", input.targetId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const raw = (data as { class_types: ClassChargeEmbed | ClassChargeEmbed[] | null })
      .class_types;
    const type = Array.isArray(raw) ? raw[0] : raw;
    const locationId = data.location_id as LocationId;

    return quoteBookingCharge(input.paymentOption, {
      kind: "class",
      locationId,
      classSlug: type?.slug ?? null,
      durationMin: Number(data.duration_min),
      title: input.title,
    });
  }

  return quoteBookingCharge(input.paymentOption, {
    kind: input.kind,
    locationId: input.locationId,
    durationMin,
    title: input.kind === "slot" ? "Lekcja indywidualna" : input.title,
  });
}
