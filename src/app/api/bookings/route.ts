import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { mapBookingError } from "@/lib/booking/errors";
import { resolveBookingTerm } from "@/lib/booking/term";
import { sendBookingEmails } from "@/lib/email";
import { allowBookingAttempt, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  bookingApiSchema,
  coercePaymentOption,
} from "@/lib/validation";

const PAYMENTS_SOON = "Płatności online wkrótce.";

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
    return Response.json(
      {
        ok: false,
        error: PAYMENTS_SOON,
        bookingId,
      },
      { status: 400 },
    );
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
      term,
    }).catch((reason: unknown) => {
      console.error("Wysyłka maili po zapisie nie powiodła się.", reason);
    }),
  );

  return Response.json({ ok: true, bookingId });
}
