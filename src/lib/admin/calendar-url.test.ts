import { describe, expect, it } from "vitest";
import { weekOffsetFromIso } from "@/lib/admin/calendar-url";

describe("weekOffsetFromIso", () => {
  it("returns 0 for the same Warsaw week", () => {
    expect(
      weekOffsetFromIso(
        "2026-09-10T10:00:00.000Z",
        "2026-09-07T08:00:00.000Z",
      ),
    ).toBe(0);
  });

  it("counts whole weeks ahead", () => {
    expect(
      weekOffsetFromIso(
        "2026-09-16T10:00:00.000Z",
        "2026-09-10T08:00:00.000Z",
      ),
    ).toBe(1);
  });
});
