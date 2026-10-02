import { revalidatePath } from "next/cache";
import { classSignupHref } from "@/lib/account/redirect";
import { createBookingCheckout } from "@/lib/booking/checkout";
import { mapBookingError } from "@/lib/booking/errors";
import { allowBookingAttempt, clientIp } from "@/lib/rate-limit";
import { hasStripeSecret } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import {
  bookingApiSchema,
  coercePaymentOption,
  guardianDisplayName,
} from "@/lib/validation";

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

  if (data.kind === "class") {
    const mapped = mapBookingError("account_required");
    return Response.json(
      {
        ok: false,
        error: mapped.message,
        accountHref: classSignupHref(data.targetId, false),
      },
      { status: mapped.status },
    );
  }

  const paymentOption = coercePaymentOption();
  if (!hasStripeSecret()) {
    return Response.json(
      {
        ok: false,
        error: "Płatności online są chwilowo niedostępne.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();

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
