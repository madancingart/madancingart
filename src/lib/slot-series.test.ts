import { describe, expect, it } from "vitest";
import {
  addIsoDays,
  addMonthsIso,
  applyCollisions,
  generateSlotSeries,
  generateWindowStarts,
  isWithinMaxRange,
  occupiedFromClasses,
  occupiedFromTrainerSlots,
  polishCreateSlotsLabel,
} from "@/lib/slot-series";

describe("generateWindowStarts", () => {
  it("fills a window with abutting slots and stops at the boundary", () => {
    expect(generateWindowStarts(10 * 60, 14 * 60, 60, 0)).toEqual([
      10 * 60,
      11 * 60,
      12 * 60,
      13 * 60,
    ]);
  });

  it("inserts the break after each slot before the next start", () => {
    expect(generateWindowStarts(10 * 60, 14 * 60, 60, 10)).toEqual([
      10 * 60,
      11 * 60 + 10,
      12 * 60 + 20,
    ]);
  });

  it("does not start a slot that would overflow the window", () => {
    expect(generateWindowStarts(10 * 60, 10 * 60 + 50, 60, 0)).toEqual([]);
    expect(generateWindowStarts(16 * 60, 21 * 60, 90, 15)).toEqual([
      16 * 60,
      17 * 60 + 45,
      19 * 60 + 30,
    ]);
  });
});

describe("generateSlotSeries range and weekdays", () => {
  const windows = [{ start: "10:00", end: "12:00" }];

  it("includes both range endpoints on matching weekdays", () => {
    const slots = generateSlotSeries({
      fromDate: "2026-09-14",
      toDate: "2026-09-16",
      weekdays: [1, 3],
      windows,
      durationMin: 60,
      breakMin: 0,
    });
    expect(slots.map((slot) => `${slot.date} ${slot.start}`)).toEqual([
      "2026-09-14 10:00",
      "2026-09-14 11:00",
      "2026-09-16 10:00",
      "2026-09-16 11:00",
    ]);
  });

  it("does not emit the day after the range end", () => {
    const slots = generateSlotSeries({
      fromDate: "2026-09-14",
      toDate: "2026-09-14",
      weekdays: [1, 2],
      windows,
      durationMin: 60,
      breakMin: 0,
    });
    expect(slots.every((slot) => slot.date === "2026-09-14")).toBe(true);
    expect(slots.some((slot) => slot.date === "2026-09-15")).toBe(false);
  });

  it("merges overlapping windows without duplicate starts", () => {
    const slots = generateSlotSeries({
      fromDate: "2026-09-14",
      toDate: "2026-09-14",
      weekdays: [1],
      windows: [
        { start: "10:00", end: "12:00" },
        { start: "11:00", end: "13:00" },
      ],
      durationMin: 60,
      breakMin: 0,
    });
    expect(slots.map((slot) => slot.start)).toEqual(["10:00", "11:00", "12:00"]);
  });

  it("returns nothing when the range exceeds three months", () => {
    const fromDate = "2026-09-10";
    const toDate = addIsoDays(addMonthsIso(fromDate, 3), 1);
    expect(isWithinMaxRange(fromDate, toDate)).toBe(false);
    expect(
      generateSlotSeries({
        fromDate,
        toDate,
        weekdays: [1],
        windows,
        durationMin: 60,
        breakMin: 0,
      }),
    ).toEqual([]);
  });

  it("allows a range ending exactly three months later", () => {
    const fromDate = "2026-09-10";
    const toDate = addMonthsIso(fromDate, 3);
    expect(isWithinMaxRange(fromDate, toDate)).toBe(true);
    expect(
      generateSlotSeries({
        fromDate,
        toDate: fromDate,
        weekdays: [4],
        windows,
        durationMin: 60,
        breakMin: 0,
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe("collisions", () => {
  const generated = generateSlotSeries({
    fromDate: "2026-09-14",
    toDate: "2026-09-16",
    weekdays: [1, 3],
    windows: [{ start: "17:00", end: "20:00" }],
    durationMin: 60,
    breakMin: 0,
  });

  it("marks overlap with a group class and leaves abutting slots free", () => {
    const occupied = occupiedFromClasses(
      [
        {
          weekday: 1,
          startTime: "18:00",
          durationMin: 50,
          name: "Latino Solo",
        },
      ],
      "2026-09-14",
      "2026-09-16",
    );
    const preview = applyCollisions(generated, occupied);
    const monday = preview.filter((slot) => slot.date === "2026-09-14");
    expect(monday.find((slot) => slot.start === "17:00")?.conflict).toBeNull();
    expect(monday.find((slot) => slot.start === "18:00")?.conflict).toBe(
      "koliduje: Latino Solo 18:00",
    );
    expect(monday.find((slot) => slot.start === "19:00")?.conflict).toBeNull();
    expect(
      preview.find((slot) => slot.date === "2026-09-16" && slot.start === "18:00")
        ?.conflict,
    ).toBeNull();
  });

  it("marks overlap with an existing trainer slot", () => {
    const occupied = occupiedFromTrainerSlots([
      {
        startsAt: "2026-09-16T16:00:00.000Z",
        endsAt: "2026-09-16T17:00:00.000Z",
      },
    ]);
    const preview = applyCollisions(generated, occupied);
    const hit = preview.find(
      (slot) => slot.date === "2026-09-16" && slot.start === "18:00",
    );
    expect(hit?.conflict).toBe("koliduje: istniejący termin 18:00");
  });

  it("does not treat touching intervals as a collision", () => {
    const preview = applyCollisions(
      [
        {
          date: "2026-09-14",
          weekday: 1,
          startMin: 10 * 60,
          endMin: 11 * 60,
          start: "10:00",
          end: "11:00",
        },
      ],
      [
        {
          date: "2026-09-14",
          startMin: 11 * 60,
          endMin: 12 * 60,
          label: "Latino Solo 11:00",
        },
      ],
    );
    expect(preview[0]?.conflict).toBeNull();
  });
});

describe("polishCreateSlotsLabel", () => {
  it("uses Polish plural forms", () => {
    expect(polishCreateSlotsLabel(1)).toBe("Utwórz 1 termin");
    expect(polishCreateSlotsLabel(23)).toBe("Utwórz 23 terminy");
    expect(polishCreateSlotsLabel(5)).toBe("Utwórz 5 terminów");
  });
});
