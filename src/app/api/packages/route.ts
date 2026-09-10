import { after } from "next/server";
import { getWeddingPackage, weddingPackageDbLabel } from "@/content/packages";
import { formatDatePl } from "@/lib/datetime";
import { sendNewPackageSchoolEmail } from "@/lib/email";
import { allowBookingAttempt, clientIp } from "@/lib/rate-limit";
import { getStripe, integrationIdentifier, siteUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPaymentsEnabled,
  packagePurchaseSchema,
  songsToStored,
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

  const parsed = packagePurchaseSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { ok: false, error: first?.message ?? "Sprawdź dane w formularzu." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if (data.website?.trim()) {
    return Response.json(
      { ok: false, error: "Nie udało się wysłać zgłoszenia." },
      { status: 400 },
    );
  }

  if (!allowBookingAttempt(clientIp(request))) {
    return Response.json(
      {
        ok: false,
        error: "Zbyt wiele prób. Spróbuj ponownie za kilka minut.",
      },
      { status: 429 },
    );
  }

  const def = getWeddingPackage(data.packageKind);
  if (!def) {
    return Response.json(
      { ok: false, error: "Nieznany pakiet." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: customerId, error: customerError } = await supabase.rpc(
    "find_or_create_customer",
    {
      p_first_name: data.firstName,
      p_last_name: data.lastName,
      p_phone: data.phone,
      p_email: data.email,
      p_kind: "pair",
      p_partner_first_name: data.partnerFirstName,
      p_partner_last_name: data.partnerLastName,
      p_guardian_name: null,
      p_guardian_phone: null,
    },
  );

  if (customerError || typeof customerId !== "string") {
    console.error("find_or_create_customer (pakiet)", customerError);
    return Response.json(
      { ok: false, error: "Nie udało się zapisać zgłoszenia." },
      { status: 500 },
    );
  }

  const songs = songsToStored(data.songs);
  const label = weddingPackageDbLabel(def);
  const { data: inserted, error: insertError } = await supabase
    .from("packages")
    .insert({
      customer_id: customerId,
      kind: def.kind,
      label,
      total_lessons: def.totalLessons,
      wedding_date: data.weddingDate,
      songs,
      price_cents: def.priceCents,
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("insert packages", insertError);
    return Response.json(
      { ok: false, error: "Nie udało się zapisać pakietu." },
      { status: 500 },
    );
  }

  const packageId = inserted.id as string;
  const mailPayload = {
    firstName: data.firstName,
    lastName: data.lastName,
    partnerFirstName: data.partnerFirstName,
    partnerLastName: data.partnerLastName,
    phone: data.phone,
    email: data.email,
    packageLabel: label,
    weddingDateLabel: formatDatePl(data.weddingDate),
    songs,
    paid: false,
  };

  after(() =>
    sendNewPackageSchoolEmail(mailPayload).catch((reason: unknown) => {
      console.error("Mail o nowym pakiecie nie wyszedł.", reason);
    }),
  );

  if (!isPaymentsEnabled()) {
    return Response.json({
      ok: true,
      packageId,
      checkoutUrl: null as string | null,
    });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "pl",
      customer_email: data.email,
      integration_identifier: integrationIdentifier("madancingart-package"),
      metadata: { package_id: packageId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "pln",
            unit_amount: def.priceCents,
            product_data: { name: label },
          },
        },
      ],
      success_url: `${siteUrl()}/pierwszy-taniec/pakiety/sukces?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/pierwszy-taniec/pakiety/anulowano`,
    });

    if (!session.url) {
      return Response.json(
        { ok: false, error: "Nie udało się otworzyć płatności." },
        { status: 500 },
      );
    }

    await supabase
      .from("packages")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", packageId);

    return Response.json({
      ok: true,
      packageId,
      checkoutUrl: session.url,
    });
  } catch (reason: unknown) {
    console.error("Stripe Checkout (pakiet)", reason);
    return Response.json(
      {
        ok: false,
        error:
          "Zgłoszenie zapisaliśmy, ale płatność online nie ruszyła. Skontaktujemy się z Wami.",
        packageId,
      },
      { status: 500 },
    );
  }
}
