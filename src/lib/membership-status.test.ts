import { describe, expect, it } from "vitest";
import {
  membershipSortRank,
  membershipStatus,
  remainingEntriesLabel,
  type MembershipPackageInput,
} from "@/lib/membership-status";

const today = "2026-09-10";

function monthly(
  overrides: Partial<MembershipPackageInput> = {},
): MembershipPackageInput {
  return {
    kind: "monthly",
    status: "active",
    validFrom: "2026-09-01",
    validUntil: "2026-09-30",
    totalLessons: null,
    usedEntries: 0,
    ...overrides,
  };
}

function pass(
  remaining: number,
  overrides: Partial<MembershipPackageInput> = {},
): MembershipPackageInput {
  const total = overrides.totalLessons ?? 4;
  return {
    kind: "pass_4",
    status: "active",
    validFrom: "2026-09-01",
    validUntil: "2026-12-10",
    totalLessons: total,
    usedEntries: total - remaining,
    ...overrides,
  };
}

describe("membershipStatus", () => {
  it("OK: miesięczny obejmujący dziś, kończy się później niż za 7 dni", () => {
    expect(membershipStatus([monthly()], today)).toEqual({
      level: "ok",
      label: "opłacone",
      detail: "do 30.09",
    });
  });

  it("OK: karnet z więcej niż jednym wejściem", () => {
    expect(membershipStatus([pass(2)], today)).toEqual({
      level: "ok",
      label: "opłacone",
      detail: "zostały 2 wejścia",
    });
  });

  it("KOŃCZY SIĘ: miesięczny w ≤ 7 dni", () => {
    expect(
      membershipStatus([monthly({ validUntil: "2026-09-17" })], today),
    ).toEqual({
      level: "ending",
      label: "kończy się",
      detail: "do 17.09",
    });
  });

  it("KOŃCZY SIĘ: zostało dokładnie 1 wejście", () => {
    expect(membershipStatus([pass(1)], today)).toEqual({
      level: "ending",
      label: "kończy się",
      detail: "zostało 1 wejście",
    });
  });

  it("NIEOPŁACONE: brak pakietu", () => {
    expect(membershipStatus([], today)).toEqual({
      level: "unpaid",
      label: "nieopłacone",
      detail: null,
    });
  });

  it("NIEOPŁACONE: miesięczny minął", () => {
    expect(
      membershipStatus(
        [monthly({ validFrom: "2026-08-01", validUntil: "2026-08-31" })],
        today,
      ),
    ).toEqual({
      level: "unpaid",
      label: "nieopłacone",
      detail: null,
    });
  });

  it("NIEOPŁACONE: karnet wyczerpany", () => {
    expect(membershipStatus([pass(0)], today)).toEqual({
      level: "unpaid",
      label: "nieopłacone",
      detail: null,
    });
  });

  it("NIEOPŁACONE: karnet po terminie", () => {
    expect(
      membershipStatus([pass(3, { validUntil: "2026-09-01" })], today),
    ).toEqual({
      level: "unpaid",
      label: "nieopłacone",
      detail: null,
    });
  });

  it("karnet z wejściami wygrywa ze kończącym się miesięcznym", () => {
    const result = membershipStatus(
      [monthly({ validUntil: "2026-09-12" }), pass(3)],
      today,
    );
    expect(result.level).toBe("ok");
    expect(result.detail).toBe("zostały 3 wejścia");
  });

  it("ignores wedding packages and pending payment", () => {
    expect(
      membershipStatus(
        [
          {
            kind: "wedding_6",
            status: "active",
            validFrom: today,
            validUntil: "2026-12-01",
            totalLessons: 6,
            usedEntries: 0,
          },
          monthly({ status: "pending_payment" }),
        ],
        today,
      ),
    ).toEqual({
      level: "unpaid",
      label: "nieopłacone",
      detail: null,
    });
  });
});

describe("remainingEntriesLabel", () => {
  it("odmienia wejścia", () => {
    expect(remainingEntriesLabel(1)).toBe("zostało 1 wejście");
    expect(remainingEntriesLabel(2)).toBe("zostały 2 wejścia");
    expect(remainingEntriesLabel(5)).toBe("zostało 5 wejść");
    expect(remainingEntriesLabel(22)).toBe("zostały 22 wejścia");
  });
});

describe("membershipSortRank", () => {
  it("czerwoni na górze", () => {
    expect(membershipSortRank("unpaid")).toBeLessThan(
      membershipSortRank("ending"),
    );
    expect(membershipSortRank("ending")).toBeLessThan(membershipSortRank("ok"));
  });
});
