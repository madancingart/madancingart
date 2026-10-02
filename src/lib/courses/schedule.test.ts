import { describe, expect, it } from "vitest";
import { courseWhenLine, generateCourseMeetings, slugifyCourseTitle } from "@/lib/courses/schedule";

describe("generateCourseMeetings", () => {
  it("bierze N spotkań od daty startu w wybranych dniach", () => {
    const meetings = generateCourseMeetings({
      startDate: "2026-10-13",
      weekdays: [2],
      startTime: "19:00",
      durationMin: 60,
      count: 6,
    });
    expect(meetings.map((item) => item.date)).toEqual([
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
      "2026-11-03",
      "2026-11-10",
      "2026-11-17",
    ]);
    expect(meetings[0]?.start).toBe("19:00");
    expect(meetings[0]?.end).toBe("20:00");
  });

  it("zaczyna od najbliższego pasującego dnia", () => {
    const meetings = generateCourseMeetings({
      startDate: "2026-10-13",
      weekdays: [4],
      startTime: "18:30",
      durationMin: 75,
      count: 2,
    });
    expect(meetings.map((item) => item.date)).toEqual(["2026-10-15", "2026-10-22"]);
  });
});

describe("courseWhenLine", () => {
  it("składa podpis karty", () => {
    expect(
      courseWhenLine({
        count: 6,
        weekdays: [2],
        startTime: "19:00",
        firstDate: "2026-10-13",
      }),
    ).toBe("6 spotkań · wtorki 19:00 · od 13.10");
  });
});

describe("slugifyCourseTitle", () => {
  it("zdejmuje polskie znaki", () => {
    expect(slugifyCourseTitle("Salsa od podstaw — 6 tygodni")).toBe(
      "salsa-od-podstaw-6-tygodni",
    );
  });
});
