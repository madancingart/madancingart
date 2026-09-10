import { priceAmountCents } from "@/content/pricing";
import type { BookingKind, LocationId } from "@/lib/types";

export type ChargeContext = {
  kind: BookingKind;
  locationId: LocationId;
  classSlug?: string | null;
  durationMin: number;
  title: string;
};

export type ChargeQuote = {
  amountCents: number;
  productName: string;
  productDescription: string;
};

export function quoteBookingCharge(
  context: ChargeContext,
): ChargeQuote | null {
  const amountCents = fullAmountCents(context);
  if (amountCents === null) {
    return null;
  }

  return {
    amountCents,
    productName: context.title,
    productDescription: "Zapis — płatność online",
  };
}

export function fullAmountCents(context: ChargeContext): number | null {
  if (context.kind === "event") {
    return null;
  }

  if (context.kind === "slot" || context.classSlug === "lekcja-indywidualna") {
    return individualAmountCents(context.locationId, context.durationMin);
  }

  if (context.kind !== "class" || !context.classSlug) {
    return null;
  }

  if (
    context.classSlug === "dzieci-4-7" ||
    context.classSlug === "dzieci-8-14"
  ) {
    return priceAmountCents(`${context.locationId}-dzieci-mies`);
  }

  if (context.classSlug === "latino-solo") {
    if (context.locationId === "mikolow") {
      return priceAmountCents("mikolow-latino-mies");
    }
    return priceAmountCents(
      context.durationMin <= 60
        ? "lubliniec-latino-4x-60"
        : "lubliniec-latino-4x-75",
    );
  }

  if (context.classSlug === "taniec-uzytkowy") {
    if (context.locationId === "mikolow") {
      return priceAmountCents(
        context.durationMin <= 60
          ? "mikolow-uzytkowy-50"
          : "mikolow-uzytkowy-75",
      );
    }
    return priceAmountCents(
      context.durationMin <= 60
        ? "lubliniec-uzytkowy-4x-60"
        : "lubliniec-uzytkowy-4x-75",
    );
  }

  return null;
}

function individualAmountCents(
  locationId: LocationId,
  durationMin: number,
): number | null {
  const hourly = priceAmountCents(`${locationId}-ind-1h`);
  if (hourly === null || durationMin <= 0) {
    return null;
  }
  return Math.round((hourly * durationMin) / 60);
}
