import { describe, expect, it } from "vitest";
import { buildCourseIcs } from "@/lib/courses/ics";

describe("buildCourseIcs", () => {
  it("pakuje spotkania jako osobne VEVENT w strefie Warszawy", () => {
    const ics = buildCourseIcs(
      [
        {
          uid: "a@madancing.art",
          start: new Date("2026-10-13T17:00:00.000Z"),
          end: new Date("2026-10-13T18:00:00.000Z"),
          summary: "Salsa — spotkanie 1/2",
          location: "Mikołów",
        },
        {
          uid: "b@madancing.art",
          start: new Date("2026-10-20T17:00:00.000Z"),
          end: new Date("2026-10-20T18:00:00.000Z"),
          summary: "Salsa — spotkanie 2/2",
        },
      ],
      new Date("2026-10-02T12:00:00.000Z"),
    );
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:Europe/Warsaw");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART;TZID=Europe/Warsaw:20261013T190000");
    expect(ics).toContain("DTSTART;TZID=Europe/Warsaw:20261020T190000");
  });
});
