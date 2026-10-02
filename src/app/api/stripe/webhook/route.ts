import type Stripe from "stripe";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { fulfillChargePayment, notifyChargePaymentFailed } from "@/lib/billing/fulfill";
import { notifyBookingById } from "@/lib/booking/notify";
import { releaseUnpaidBooking } from "@/lib/booking/release";
import { activatePackage } from "@/lib/packages/activate";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function bookingIdFromSession(session: Stripe.Checkout.Session): string | null {
  const fromMeta = session.metadata?.booking_id?.trim();
  if (fromMeta) {
    return fromMeta;
  }
  return session.client_reference_id?.trim() || null;
}

async function markBookingPaid(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = bookingIdFromSession(session);
  if (!bookingId) {
    return;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("id", bookingId)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return;
  }

  revalidatePath("/grafik");
  after(() =>
    notifyBookingById(bookingId).catch((reason: unknown) => {
      console.error("Wysyłka maili po płatności nie powiodła się.", reason);
    }),
  );
}

async function markPackagePaid(session: Stripe.Checkout.Session): Promise<void> {
  const packageId = session.metadata?.package_id?.trim();
  if (!packageId) {
    return;
  }

  const supabase = createAdminClient();
  const result = await activatePackage({
    supabase,
    packageId,
    paymentMethod: "stripe",
    stripeSessionId: session.id,
    actorId: null,
    actorLabel: "system",
  });

  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function fulfillPaidSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.package_id) {
    await markPackagePaid(session);
    return;
  }
  await markBookingPaid(session);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) {
    return Response.json({ error: "Brak podpisu webhooka." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return Response.json({ error: "Nieprawidłowy podpis." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    if (session.metadata?.charge_ids) {
      const shouldBook =
        event.type === "checkout.session.async_payment_succeeded" ||
        session.payment_status === "paid";
      if (shouldBook) {
        await fulfillChargePayment(session);
      }
    } else if (
      event.type === "checkout.session.async_payment_succeeded" ||
      session.payment_status === "paid" ||
      session.status === "complete"
    ) {
      await fulfillPaidSession(session);
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object;
    if (session.metadata?.charge_ids) {
      await notifyChargePaymentFailed(session);
    }
  }

  if (event.type === "checkout.session.expired") {
    const bookingId = bookingIdFromSession(event.data.object);
    if (
      bookingId &&
      !event.data.object.metadata?.package_id &&
      !event.data.object.metadata?.charge_ids
    ) {
      await releaseUnpaidBooking(bookingId);
      revalidatePath("/grafik");
    }
  }

  return Response.json({ received: true });
}
