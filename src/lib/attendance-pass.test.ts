import { describe, expect, it } from "vitest";
import {
  hasCoveringMonthly,
  journalPassState,
  pickEntryPassToConsume,
  type ConsumablePass,
} from "@/lib/attendance-pass";

const session = "2026-09-10";

function pass(
  remaining: number,
  overrides: Partial<ConsumablePass> = {},
): ConsumablePass {
  const total = overrides.totalLessons ?? 4;
  return {
    id: overrides.id ?? "pass-1",
    kind: "pass_4",
    status: "active",
    validFrom: "2026-09-01",
    validUntil: "2026-12-10",
    totalLessons: total,
    usedEntries: total - remaining,
    ...overrides,
  };
}

function monthly(overrides: Partial<ConsumablePass> = {}): ConsumablePass {
  return {
    id: "monthly-1",
    kind: "monthly",
    status: "active",
    validFrom: "2026-09-01",
    validUntil: "2026-09-30",
    totalLessons: null,
    usedEntries: 0,
    ...overrides,
  };
}

describe("pickEntryPassToConsume", () => {
  it("picks an active pass covering the date", () => {
    expect(pickEntryPassToConsume([pass(3)], session)).toEqual({
      id: "pass-1",
      remainingBefore: 3,
    });
  });

  it("prefers the pass with fewer remaining entries", () => {
    const result = pickEntryPassToConsume(
      [
        pass(3, { id: "a" }),
        pass(1, { id: "b", totalLessons: 8, usedEntries: 7 }),
      ],
      session,
    );
    expect(result?.id).toBe("b");
  });

  it("ignores monthly, exhausted, pending and out-of-range passes", () => {
    expect(
      pickEntryPassToConsume(
        [
          monthly(),
          pass(0, { id: "empty" }),
          pass(2, { id: "pending", status: "pending_payment" }),
          pass(2, { id: "late", validUntil: "2026-09-01" }),
        ],
        session,
      ),
    ).toBeNull();
  });
});

describe("hasCoveringMonthly", () => {
  it("is true only for an active monthly covering the date", () => {
    expect(hasCoveringMonthly([monthly()], session)).toBe(true);
    expect(
      hasCoveringMonthly([monthly({ validUntil: "2026-08-31" })], session),
    ).toBe(false);
  });
});

describe("journalPassState", () => {
  it("monthly: no consume, not unpaid", () => {
    expect(
      journalPassState({
        present: true,
        packageId: null,
        packages: [monthly()],
        sessionDateIso: session,
      }),
    ).toEqual({
      unpaid: false,
      remainingLabel: "karnet miesięczny do 30.09",
    });
  });

  it("pass after consume shows remaining including this session", () => {
    expect(
      journalPassState({
        present: true,
        packageId: "pass-1",
        packages: [pass(2)],
        sessionDateIso: session,
      }),
    ).toEqual({
      unpaid: false,
      remainingLabel: "zostały 2 wejścia",
    });
  });

  it("present without package is unpaid", () => {
    expect(
      journalPassState({
        present: true,
        packageId: null,
        packages: [],
        sessionDateIso: session,
      }),
    ).toEqual({
      unpaid: true,
      remainingLabel: "nieopłacone",
    });
  });

  it("absent without package is not highlighted unpaid", () => {
    expect(
      journalPassState({
        present: false,
        packageId: null,
        packages: [],
        sessionDateIso: session,
      }),
    ).toEqual({
      unpaid: false,
      remainingLabel: null,
    });
  });
});
