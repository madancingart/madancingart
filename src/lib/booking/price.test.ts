import { describe, expect, it } from "vitest";
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
  it("quotes the full class amount", () => {
    const quote = quoteBookingCharge({
      kind: "class",
      locationId: "mikolow",
      classSlug: "latino-solo",
      durationMin: 50,
      title: "Latino Solo",
    });
    expect(quote?.amountCents).toBe(12_000);
    expect(quote?.productName).toBe("Latino Solo");
  });

  it("returns null when there is no cennik amount", () => {
    expect(
      quoteBookingCharge({
        kind: "event",
        locationId: "mikolow",
        durationMin: 90,
        title: "Warsztaty",
      }),
    ).toBeNull();
  });
});
