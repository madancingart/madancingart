import { describe, expect, it } from "vitest";
import { assignGroupCodes, groupCode } from "@/lib/billing/group-code";

describe("kod grupy", () => {
  it("składa lokalizację, dzień, godzinę i rodzaj", () => {
    expect(
      groupCode({
        locationId: "mikolow",
        weekday: 1,
        startTime: "18:00:00",
        slug: "latino",
      }),
    ).toBe("MIK-PN-1800-LATINO");
  });

  it("rozróżnia kolizje stabilnym sufiksem", () => {
    const codes = assignGroupCodes([
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        locationId: "mikolow",
        weekday: 1,
        startTime: "18:00",
        slug: "latino",
      },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        locationId: "mikolow",
        weekday: 1,
        startTime: "18:00",
        slug: "latino",
      },
    ]);
    expect(codes.get("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe("MIK-PN-1800-LATINO");
    expect(codes.get("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toBe(
      "MIK-PN-1800-LATINO-2",
    );
  });
});
