import { describe, expect, it } from "vitest";
import { RESERVATION_FEE_CENTS } from "@/content/pricing";
import { fullAmountCents, quoteBookingCharge } from "@/lib/booking/price";

describe("fullAmountCents", () => {
  it("uses monthly children price in both locations", () => {
    expect(
      fullAmountCents({
        kind: "class",
        locationId: "mikolow",
        classSlug: "dzieci-4-7",
        durationMin: 45,
        title: "Dzieci",
      }),
    ).toBe(13_000);
  });

  it("picks Lubliniec latino pass by duration", () => {
    expect(
      fullAmountCents({
        kind: "class",
        locationId: "lubliniec",
        classSlug: "latino-solo",
        durationMin: 60,
        title: "Latino",
      }),
    ).toBe(12_000);
    expect(
      fullAmountCents({
        kind: "class",
        locationId: "lubliniec",
        classSlug: "latino-solo",
        durationMin: 90,
        title: "Latino",
      }),
    ).toBe(18_000);
  });

  it("prorates individual lessons from the hourly rate", () => {
    expect(
      fullAmountCents({
        kind: "slot",
        locationId: "mikolow",
        durationMin: 60,
        title: "Lekcja indywidualna",
      }),
    ).toBe(15_000);
    expect(
      fullAmountCents({
        kind: "slot",
        locationId: "lubliniec",
        durationMin: 90,
        title: "Lekcja indywidualna",
      }),
    ).toBe(22_500);
  });

  it("does not invent a full price for events", () => {
    expect(
      fullAmountCents({
        kind: "event",
        locationId: "mikolow",
        durationMin: 120,
        title: "Pokaz",
      }),
    ).toBeNull();
  });
});

describe("quoteBookingCharge", () => {
  it("uses the reservation fee from pricing.ts", () => {
    const quote = quoteBookingCharge("reservation", {
      kind: "event",
      locationId: "mikolow",
      durationMin: 90,
      title: "Warsztaty",
    });
    expect(quote?.amountCents).toBe(RESERVATION_FEE_CENTS);
  });

  it("returns null for onsite and for unpaid event full checkout", () => {
    const context = {
      kind: "event" as const,
      locationId: "mikolow" as const,
      durationMin: 90,
      title: "Warsztaty",
    };
    expect(quoteBookingCharge("onsite", context)).toBeNull();
    expect(quoteBookingCharge("full", context)).toBeNull();
  });
});
