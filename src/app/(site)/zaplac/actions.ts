"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { checkoutIdsForOwnedCharge, checkoutIdsForToken } from "@/lib/billing/pay-link";
import { createCheckout } from "@/lib/billing/checkout";
import { allowPayTokenLookup, clientIpFromHeaders } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type CheckoutStart = { url: string } | { error: string };

export async function startTokenCheckout(
  token: string,
  accepted: boolean,
): Promise<CheckoutStart> {
  if (!accepted) {
    return { error: "Zaakceptuj umowę i regulamin zajęć." };
  }
  const parsed = z.uuid().safeParse(token);
  if (!parsed.success) {
    return { error: "Nie znaleziono tej płatności." };
  }
  const headerList = await headers();
  if (!allowPayTokenLookup(clientIpFromHeaders(headerList))) {
    return { error: "Zbyt wiele prób. Spróbuj ponownie za kilka minut." };
  }

  const ids = await checkoutIdsForToken(parsed.data);
  if (!ids || ids.length === 0) {
    return { error: "Tej płatności nie da się już opłacić." };
  }

  try {
    return await createCheckout(ids);
  } catch (reason: unknown) {
    const message = reason instanceof Error ? reason.message : "";
    return { error: message || "Nie udało się otworzyć płatności." };
  }
}

export async function startOwnedCheckout(
  chargeId: string,
  accepted: boolean,
): Promise<CheckoutStart> {
  if (!accepted) {
    return { error: "Zaakceptuj umowę i regulamin zajęć." };
  }
  const parsed = z.uuid().safeParse(chargeId);
  if (!parsed.success) {
    return { error: "Nie znaleziono tej należności." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Zaloguj się, żeby opłacić należność." };
  }

  const { data: participants } = await supabase.rpc("my_participants");
  const customerIds = ((participants ?? []) as { id: string }[]).map((person) => person.id);
  const ids = await checkoutIdsForOwnedCharge(parsed.data, customerIds);
  if (!ids || ids.length === 0) {
    return { error: "Tej należności nie da się już opłacić." };
  }

  try {
    return await createCheckout(ids);
  } catch (reason: unknown) {
    const message = reason instanceof Error ? reason.message : "";
    return { error: message || "Nie udało się otworzyć płatności." };
  }
}
