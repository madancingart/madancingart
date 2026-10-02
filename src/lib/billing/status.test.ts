import { describe, expect, it } from "vitest";
import {
  arrearsLine,
  billingStatus,
  pickPayableCharge,
  type BillingCharge,
  type BillingPass,
  type BillingStatusInput,
} from "@/lib/billing/status";

const today = "2026-10-02";

function input(overrides: Partial<BillingStatusInput> = {}): BillingStatusInput {
  return {
    today,
    enrollmentStatus: "active",
    billingMode: "monthly",
    paidUntil: "2026-11-30",
    holdExpiresAt: null,
    charges: [],
    pass: null,
    ...overrides,
  };
}

function charge(overrides: Partial<BillingCharge> = {}): BillingCharge {
  return {
    status: "open",
    dueDate: "2026-11-05",
    amountCents: 12_000,
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
    ...overrides,
  };
}

function pass(overrides: Partial<BillingPass> = {}): BillingPass {
  return {
    remaining: 2,
    total: 4,
    validUntil: "2026-12-31",
    ...overrides,
  };
}

describe("billingStatus", () => {
  it("pending wygrywa z zaległą należnością", () => {
    const status = billingStatus(
      input({
        enrollmentStatus: "pending",
        holdExpiresAt: "2026-10-03T16:00:00.000Z",
        charges: [charge({ dueDate: "2026-09-01" })],
      }),
    );
    expect(status.tone).toBe("pending");
    expect(status.reason).toBe("pending");
    expect(status.label).toBe(
      "Miejsce czeka do 3.10, 18:00 — opłać, żeby je potwierdzić",
    );
  });

  it("pending bez terminu rezerwacji ma krótką prośbę o opłacenie", () => {
    const status = billingStatus(input({ enrollmentStatus: "pending" }));
    expect(status.label).toBe(
      "Miejsce czeka na opłacenie — opłać, żeby je potwierdzić",
    );
  });

  it("red: otwarta należność po terminie, najstarsza kwota", () => {
    const status = billingStatus(
      input({
        charges: [
          charge({ dueDate: "2026-10-20", amountCents: 8_000 }),
          charge({ dueDate: "2026-09-28", amountCents: 12_000 }),
        ],
      }),
    );
    expect(status).toMatchObject({
      tone: "red",
      reason: "overdue",
      label: "Zaległość 120 zł",
    });
  });

  it("ignoruje anulowane należności", () => {
    const status = billingStatus(
      input({
        charges: [charge({ status: "void", dueDate: "2026-09-01" })],
      }),
    );
    expect(status.tone).toBe("green");
    expect(status.reason).toBe("paid");
  });

  it("amber: otwarta należność z terminem dziś albo później", () => {
    const dueToday = billingStatus(
      input({ charges: [charge({ dueDate: today })] }),
    );
    expect(dueToday).toMatchObject({
      tone: "amber",
      reason: "open",
      label: "Do zapłaty 120 zł do 2.10",
    });

    const later = billingStatus(
      input({ charges: [charge({ dueDate: "2026-11-05" })] }),
    );
    expect(later.label).toBe("Do zapłaty 120 zł do 5.11");
  });

  it("red wygrywa z późniejszą otwartą należnością", () => {
    const status = billingStatus(
      input({
        charges: [
          charge({ dueDate: "2026-11-05" }),
          charge({ dueDate: "2026-09-30", amountCents: 12_000 }),
        ],
      }),
    );
    expect(status.tone).toBe("red");
    expect(status.reason).toBe("overdue");
  });

  it("red pass4: brak karnetu i brak pokrycia okresem", () => {
    const status = billingStatus(
      input({
        billingMode: "pass4",
        paidUntil: "2026-09-30",
        pass: null,
      }),
    );
    expect(status).toMatchObject({
      tone: "red",
      reason: "pass_uncovered",
      label: "Brak ważnego karnetu",
    });
  });

  it("red pass4: karnet zużyty albo po dacie i okres się skończył", () => {
    const usedUp = billingStatus(
      input({
        billingMode: "pass4",
        paidUntil: null,
        pass: pass({ remaining: 0 }),
      }),
    );
    expect(usedUp.reason).toBe("pass_uncovered");

    const expired = billingStatus(
      input({
        billingMode: "pass4",
        paidUntil: "2026-09-01",
        pass: pass({ validUntil: "2026-09-30", remaining: 3 }),
      }),
    );
    expect(expired.reason).toBe("pass_uncovered");
  });

  it("pass4 z pokryciem okresu nie jest czerwony mimo braku karnetu", () => {
    const status = billingStatus(
      input({
        billingMode: "pass4",
        paidUntil: "2026-11-30",
        pass: null,
      }),
    );
    expect(status.tone).toBe("green");
    expect(status.reason).toBe("paid");
  });

  it("pass4 z opłaconą należnością obejmującą dziś nie jest czerwony", () => {
    const status = billingStatus(
      input({
        billingMode: "pass4",
        paidUntil: null,
        pass: null,
        charges: [
          charge({
            status: "paid",
            periodStart: "2026-10-01",
            periodEnd: "2026-10-31",
          }),
        ],
      }),
    );
    expect(status.tone).toBe("green");
    expect(status.reason).toBe("clear");
  });

  it("miesięczny zapis bez karnetu nie wpada w gałąź pass4", () => {
    const status = billingStatus(
      input({
        billingMode: "monthly",
        paidUntil: "2026-11-30",
        pass: null,
      }),
    );
    expect(status).toMatchObject({
      tone: "green",
      reason: "paid",
      label: "Opłacone do 30.11",
    });
  });

  it("amber pass4: zostało jedno wejście", () => {
    const status = billingStatus(
      input({
        billingMode: "pass4",
        paidUntil: null,
        pass: pass({ remaining: 1 }),
      }),
    );
    expect(status).toMatchObject({
      tone: "amber",
      reason: "pass_low",
      label: "Zostało 1 z 4 wejść, ważny do 31.12",
    });
  });

  it("green pass4: zostały wejścia", () => {
    const status = billingStatus(
      input({
        billingMode: "pass4",
        paidUntil: "2026-10-05",
        pass: pass({ remaining: 2 }),
      }),
    );
    expect(status).toMatchObject({
      tone: "green",
      reason: "pass_ok",
      label: "Zostały 2 z 4 wejść, ważny do 31.12",
    });
  });

  it("karnet bez daty końca nie dopisuje „ważny do”", () => {
    const status = billingStatus(
      input({
        billingMode: "pass4",
        pass: pass({ validUntil: null, remaining: 3, total: 4 }),
      }),
    );
    expect(status.label).toBe("Zostały 3 z 4 wejść");
  });

  it("amber: paid_until w ciągu 7 dni bez kolejnej opłaconej należności", () => {
    const onEdge = billingStatus(input({ paidUntil: "2026-10-09" }));
    expect(onEdge).toMatchObject({
      tone: "amber",
      reason: "ending",
      label: "Opłacone do 9.10",
    });

    const todayCovered = billingStatus(input({ paidUntil: today }));
    expect(todayCovered.reason).toBe("ending");
  });

  it("ósmy dzień i kolejna opłacona należność zostają zielone", () => {
    const eightDays = billingStatus(input({ paidUntil: "2026-10-10" }));
    expect(eightDays).toMatchObject({ tone: "green", reason: "paid" });

    const prepaid = billingStatus(
      input({
        paidUntil: "2026-10-06",
        charges: [
          charge({
            status: "paid",
            periodStart: "2026-11-01",
            periodEnd: "2026-11-30",
          }),
        ],
      }),
    );
    expect(prepaid).toMatchObject({ tone: "green", reason: "paid" });
  });

  it("green: wszystko inne, także po skończonym okresie miesięcznym bez otwartej należności", () => {
    const past = billingStatus(input({ paidUntil: "2026-09-30", charges: [] }));
    expect(past).toMatchObject({ tone: "green", reason: "clear", label: "Bez zaległości" });

    const empty = billingStatus(input({ paidUntil: null }));
    expect(empty.reason).toBe("clear");
  });
});

describe("arrearsLine", () => {
  it("składa baner zaległości", () => {
    expect(arrearsLine(12_000, "Latino Solo, listopad")).toBe(
      "Zaległa płatność: 120 zł (Latino Solo, listopad)",
    );
  });
});

describe("pickPayableCharge", () => {
  it("bierze najstarszą zaległość, a bez niej najbliższy termin", () => {
    const charges = [
      charge({ dueDate: "2026-11-05" }),
      charge({ dueDate: "2026-09-01" }),
      charge({ dueDate: "2026-09-20" }),
    ];
    expect(pickPayableCharge(charges, today)?.dueDate).toBe("2026-09-01");
    expect(
      pickPayableCharge([charge({ dueDate: "2026-11-20" }), charge()], today)?.dueDate,
    ).toBe("2026-11-05");
  });
});
