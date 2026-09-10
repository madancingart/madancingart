import { describe, expect, it } from "vitest";
import {
  customerDisplayName,
  customerListPaymentStatus,
} from "@/lib/admin/customer-label";
import type { MembershipPackageInput } from "@/lib/membership-status";

describe("customerDisplayName", () => {
  it("joins a pair with both people", () => {
    expect(
      customerDisplayName({
        kind: "pair",
        firstName: "Anna",
        lastName: "Kowalska",
        partnerFirstName: "Jan",
        partnerLastName: "Nowak",
      }),
    ).toBe("Anna Kowalska i Jan Nowak");
  });

  it("shows guardian for a child", () => {
    expect(
      customerDisplayName({
        kind: "child",
        firstName: "Zosia",
        lastName: "Kowalska",
        guardianName: "Anna",
      }),
    ).toBe("Zosia Kowalska (opiekun: Anna)");
  });

  it("uses adult first and last name", () => {
    expect(
      customerDisplayName({
        kind: "adult",
        firstName: "Marek",
        lastName: "Lis",
      }),
    ).toBe("Marek Lis");
  });
});

describe("customerListPaymentStatus", () => {
  const today = "2026-09-10";

  it("keeps group membership when a pass covers today", () => {
    const packages: MembershipPackageInput[] = [
      {
        kind: "monthly",
        status: "active",
        validFrom: "2026-09-01",
        validUntil: "2026-09-30",
        totalLessons: null,
        usedEntries: 0,
      },
    ];
    const status = customerListPaymentStatus(packages, today);
    expect(status.level).toBe("ok");
    expect(status.label).toBe("opłacone");
  });

  it("treats an active wedding package as paid", () => {
    const packages: MembershipPackageInput[] = [
      {
        kind: "wedding_10",
        status: "active",
        validFrom: null,
        validUntil: null,
        totalLessons: 10,
        usedEntries: 2,
      },
    ];
    const status = customerListPaymentStatus(packages, today);
    expect(status.level).toBe("ok");
    expect(status.detail).toBe("pakiet ślubny");
  });
});
