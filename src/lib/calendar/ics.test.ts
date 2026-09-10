import { describe, expect, it } from "vitest";
import {
  buildIcsCalendar,
  classRrule,
  escapeIcsText,
  foldIcsLine,
  formatIcsUtc,
  slotSummary,
} from "@/lib/calendar/ics";

describe("escapeIcsText", () => {
  it("escapes commas, semicolons and newlines", () => {
    expect(escapeIcsText("Mikołów, sala; test\nlinia")).toBe(
      "Mikołów\\, sala\\; test\\nlinia",
    );
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines intact", () => {
    expect(foldIcsLine("SUMMARY:Zajęcia")).toBe("SUMMARY:Zajęcia");
  });

  it("folds long lines with a leading space", () => {
    const line = `SUMMARY:${"A".repeat(80)}`;
    const folded = foldIcsLine(line);
    expect(folded).toContain("\r\n ");
    expect(folded.split("\r\n")[0]?.length).toBe(75);
  });
});

describe("buildIcsCalendar", () => {
  it("emits a weekly class with refresh hints", () => {
    const start = new Date("2026-09-10T17:00:00.000Z");
    const end = new Date("2026-09-10T17:50:00.000Z");
    const ics = buildIcsCalendar(
      [
        {
          uid: "class-1@madancing.art",
          start,
          end,
          summary: "Latino Solo",
          location: "Mikołów, ul. Świerkowa 3",
          rrule: classRrule(4, new Date("2027-05-01T00:00:00.000Z")),
        },
      ],
      start,
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:M&A Dancing Art");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT15M");
    expect(ics).toContain("SUMMARY:Latino Solo");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=TH");
    expect(ics).toContain(`DTSTART:${formatIcsUtc(start)}`);
  });
});

describe("slotSummary", () => {
  it("labels open, booked and blocked slots", () => {
    expect(slotSummary("open", null, null)).toBe("Wolny termin indywidualny");
    expect(slotSummary("booked", "Anna Nowak", "salsa")).toBe(
      "Indywidualne — Anna Nowak (salsa)",
    );
    expect(slotSummary("blocked", null, null)).toBe("Zablokowany termin");
  });
});
