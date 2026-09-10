import { describe, expect, it } from "vitest";
import {
  classDatesInMonth,
  heldClassDates,
  parseYearMonth,
} from "@/lib/admin/class-dates";

describe("classDatesInMonth", () => {
  it("lists Mondays in September 2026", () => {
    expect(classDatesInMonth(2026, 9, 1)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
  });

  it("lists Tuesdays including the 1st", () => {
    expect(classDatesInMonth(2026, 9, 2)[0]).toBe("2026-09-01");
  });
});

describe("heldClassDates", () => {
  it("keeps past and today, skips future and cancelled", () => {
    expect(
      heldClassDates({
        year: 2026,
        month: 9,
        weekday: 1,
        todayIso: "2026-09-10",
        cancelledDates: new Set(["2026-09-07"]),
      }),
    ).toEqual([]);
  });

  it("counts a held Monday before today", () => {
    expect(
      heldClassDates({
        year: 2026,
        month: 9,
        weekday: 1,
        todayIso: "2026-09-10",
        cancelledDates: new Set(),
      }),
    ).toEqual(["2026-09-07"]);
  });
});

describe("parseYearMonth", () => {
  it("accepts YYYY-MM", () => {
    expect(parseYearMonth("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseYearMonth("2026-13")).toBeNull();
  });
});
