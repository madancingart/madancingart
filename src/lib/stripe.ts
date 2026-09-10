import "server-only";

import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("Brak STRIPE_SECRET_KEY.");
  }
  if (!cached) {
    cached = new Stripe(key);
  }
  return cached;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function hasStripeSecret(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function integrationIdentifier(prefix: string): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length] ?? "a",
  ).join("");
  return `${prefix}-${suffix}`;
}
