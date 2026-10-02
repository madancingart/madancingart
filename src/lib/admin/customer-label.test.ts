import { describe, expect, it } from "vitest";
import { customerDisplayName, customerListBilling } from "@/lib/admin/customer-label";

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

describe("customerListBilling", () => {
  it("stays clear without an enrollment", () => {
    expect(
      customerListBilling({ statuses: [], weddingActive: false, weddingPending: false }),
    ).toEqual({ tone: "green", reason: "clear", label: "Bez zaległości" });
  });

  it("marks a pending wedding package", () => {
    expect(
      customerListBilling({ statuses: [], weddingActive: false, weddingPending: true }).label,
    ).toBe("Pakiet ślubny");
  });

  it("keeps the worse enrollment tone", () => {
    const status = customerListBilling({
      statuses: [
        { tone: "green", reason: "paid", label: "Opłacone do 1.11" },
        { tone: "red", reason: "overdue", label: "Zaległa płatność" },
      ],
      weddingActive: true,
      weddingPending: false,
    });
    expect(status.tone).toBe("red");
  });
});
