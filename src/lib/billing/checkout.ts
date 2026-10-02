import "server-only";

import {
  chargesForCheckout,
  type CheckoutCharge,
} from "@/lib/billing/charge-set";
import { getStripe, integrationIdentifier, siteUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type ChargeRow = {
  id: string;
  customer_id: string;
  enrollment_id: string | null;
  status: "open" | "paid" | "void";
  amount_cents: number;
  label: string;
  period_start: string | null;
  stripe_checkout_session_id: string | null;
};

/**
 * Stripe Checkout dla należności z bazy.
 * Kwoty biorą się wyłącznie z charges.amount_cents.
 */
export async function createCheckout(chargeIds: readonly string[]): Promise<{ url: string }> {
  const unique = [...new Set(chargeIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Brak należności do opłacenia.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("charges")
    .select(
      "id, customer_id, enrollment_id, status, amount_cents, label, period_start, stripe_checkout_session_id",
    )
    .in("id", unique);

  if (error || !data) {
    throw new Error("Nie udało się odczytać należności.");
  }

  const selected = chargesForCheckout(
    (data as ChargeRow[]).map(toCheckoutCharge),
  ).filter((charge) => charge.amountCents > 0);

  if (selected.length === 0) {
    throw new Error("Nie udało się przygotować płatności.");
  }

  const reused = await reuseOpenSession(selected);
  if (reused) {
    return { url: reused };
  }

  const email = await accountEmail(selected[0]?.customerId ?? "");
  if (!email) {
    throw new Error("Brak adresu e-mail na koncie.");
  }

  const ids = selected.map((charge) => charge.id);
  const origin = siteUrl();
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "pl",
    customer_email: email,
    integration_identifier: integrationIdentifier("madancingart-charges"),
    success_url: `${origin}/konto/platnosci?status=ok`,
    cancel_url: `${origin}/konto?platnosc=anulowana`,
    metadata: { charge_ids: ids.join(",") },
    line_items: selected.map((charge) => ({
      quantity: 1,
      price_data: {
        currency: "pln",
        unit_amount: charge.amountCents,
        product_data: { name: charge.label.slice(0, 120) || "Należność" },
      },
    })),
  });

  if (!session.url) {
    throw new Error("Nie udało się otworzyć płatności Stripe.");
  }

  const { error: saveError } = await admin
    .from("charges")
    .update({ stripe_checkout_session_id: session.id })
    .in("id", ids);

  if (saveError) {
    throw new Error("Nie udało się zapisać sesji płatności.");
  }

  return { url: session.url };
}

function toCheckoutCharge(row: ChargeRow): CheckoutCharge {
  return {
    id: row.id,
    status: row.status,
    periodStart: row.period_start ? row.period_start.slice(0, 10) : null,
    customerId: row.customer_id,
    amountCents: row.amount_cents,
    label: row.label,
    enrollmentId: row.enrollment_id,
    stripeSessionId: row.stripe_checkout_session_id,
  };
}

async function reuseOpenSession(selected: readonly CheckoutCharge[]): Promise<string | null> {
  const sessionIds = [
    ...new Set(
      selected
        .map((charge) => charge.stripeSessionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (sessionIds.length !== 1) {
    return null;
  }

  const sessionId = sessionIds[0];
  if (!sessionId) {
    return null;
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const stored = (session.metadata?.charge_ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .sort()
    .join(",");
  const want = selected
    .map((charge) => charge.id)
    .slice()
    .sort()
    .join(",");

  if (session.status === "open" && session.url && stored === want) {
    return session.url;
  }
  return null;
}

async function accountEmail(customerId: string): Promise<string | null> {
  if (!customerId) {
    return null;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("email, owner_user_id")
    .eq("id", customerId)
    .maybeSingle();
  const row = data as { email: string | null; owner_user_id: string | null } | null;
  if (!row) {
    return null;
  }
  if (row.owner_user_id) {
    const user = await admin.auth.admin.getUserById(row.owner_user_id);
    const email = user.data.user?.email?.trim();
    if (email) {
      return email;
    }
  }
  return row.email?.trim() || null;
}
