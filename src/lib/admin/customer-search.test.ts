import { describe, expect, it } from "vitest";
import {
  customerSearchOrFilter,
  digitsFromQuery,
  sanitizeCustomerQuery,
} from "@/lib/admin/customer-search";

describe("customer search", () => {
  it("strips PostgREST wildcards", () => {
    expect(sanitizeCustomerQuery("Kowa%lski*")).toBe("Kowalski");
  });

  it("extracts digits from a spaced phone fragment", () => {
    expect(digitsFromQuery("512 345")).toBe("512345");
  });

  it("searches partner, guardian and phone_norm", () => {
    const filter = customerSearchOrFilter("512 345");
    expect(filter).toContain("partner_last_name.ilike.%512 345%");
    expect(filter).toContain("guardian_name.ilike.%512 345%");
    expect(filter).toContain("phone_norm.ilike.%512345%");
  });

  it("returns null for empty input", () => {
    expect(customerSearchOrFilter("  ")).toBeNull();
  });
});
