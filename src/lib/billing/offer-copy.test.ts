import { describe, expect, it } from "vitest";
import { quoteFirst } from "@/lib/billing/engine";
import {
  alreadyCoveredMessage,
  describeFirstPayment,
  isEnrollmentCovered,
  passChoiceLabel,
  prepaidChoiceLabel,
} from "@/lib/billing/offer-copy";
import { chargesForCheckout, chargesWithOlder } from "@/lib/billing/charge-set";
import type { CheckoutCharge } from "@/lib/billing/charge-set";

const monday = { weekday: 1, startTime: "18:00" };

describe("describeFirstPayment", () => {
  it("składa zdanie z pierwszej płatności i kolejnego miesiąca", () => {
    const quote = quoteFirst(monday, 12_000, "2026-07-14", "10:00");
    expect(describeFirstPayment(quote, 12_000)).toBe(
      "Pierwsza płatność: 60 zł — 2 zajęcia w lipcu (20.07, 27.07) × 30 zł. Od sierpnia: 120 zł miesięcznie, płatne do 5. dnia miesiąca.",
    );
  });
});

describe("alreadyCoveredMessage", () => {
  it("podaje opłacone do", () => {
    expect(alreadyCoveredMessage("2026-12-31")).toBe(
      "Jesteś już zapisany/a na te zajęcia — opłacone do 31.12. Nic nie musisz robić.",
    );
  });
});

describe("isEnrollmentCovered", () => {
  it("łapie przedpłatę i aktywny karnet", () => {
    expect(
      isEnrollmentCovered({
        today: "2026-10-02",
        paidUntil: "2026-12-31",
        passRemaining: 0,
        passValidUntil: null,
      }),
    ).toBe(true);
    expect(
      isEnrollmentCovered({
        today: "2026-10-02",
        paidUntil: "2026-09-30",
        passRemaining: 2,
        passValidUntil: "2027-01-02",
      }),
    ).toBe(true);
    expect(
      isEnrollmentCovered({
        today: "2026-10-02",
        paidUntil: null,
        passRemaining: 0,
        passValidUntil: null,
      }),
    ).toBe(false);
  });
});

describe("choice labels", () => {
  it("formatuje przedpłatę i karnet", () => {
    expect(prepaidChoiceLabel(36_000)).toBe("3 miesiące z góry: 360 zł");
    expect(passChoiceLabel(12_000)).toBe("Karnet 4 wejścia: 120 zł");
  });
});

function charge(partial: Partial<CheckoutCharge> & Pick<CheckoutCharge, "id" | "periodStart">): CheckoutCharge {
  return {
    status: "open",
    customerId: "c1",
    amountCents: 1000,
    label: partial.id,
    enrollmentId: "e1",
    stripeSessionId: null,
    ...partial,
  };
}

describe("chargesForCheckout", () => {
  it("bierze najstarsze otwarte jednego klienta, najwyżej 10", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      charge({
        id: `id-${String(index).padStart(2, "0")}`,
        periodStart: `2026-01-${String(index + 1).padStart(2, "0")}`,
      }),
    );
    rows.push(charge({ id: "paid", periodStart: "2025-12-01", status: "paid" }));
    rows.push(charge({ id: "other", periodStart: "2025-01-01", customerId: "c2" }));
    const picked = chargesForCheckout(rows);
    expect(picked).toHaveLength(0);
  });

  it("sortuje po okresie i ucina do 10", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      charge({
        id: `id-${String(index).padStart(2, "0")}`,
        periodStart: `2026-01-${String(12 - index).padStart(2, "0")}`,
      }),
    );
    const picked = chargesForCheckout(rows);
    expect(picked).toHaveLength(10);
    expect(picked[0]?.periodStart).toBe("2026-01-01");
    expect(picked[9]?.periodStart).toBe("2026-01-10");
  });

  it("dokleja starsze należności tego zapisu", () => {
    const rows = [
      charge({ id: "new", periodStart: "2026-11-01" }),
      charge({ id: "old", periodStart: "2026-09-01" }),
      charge({ id: "mid", periodStart: "2026-10-01" }),
      charge({ id: "other-enrollment", periodStart: "2026-08-01", enrollmentId: "e2" }),
    ];
    expect(chargesWithOlder(rows, "mid").map((item) => item.id)).toEqual(["old", "mid"]);
  });
});
