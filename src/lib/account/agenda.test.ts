import { describe, expect, it } from "vitest";
import { addIsoDays, buildAgenda, isoWeekday } from "@/lib/account/agenda";

describe("buildAgenda", () => {
  it("układa zajęcia z grafiku i oznacza odwołany termin", () => {
    expect(isoWeekday("2026-10-02")).toBe(5);
    expect(addIsoDays("2026-10-02", 13)).toBe("2026-10-15");

    const items = buildAgenda({
      todayIso: "2026-10-02",
      dayCount: 14,
      groups: [
        {
          enrollmentId: "enr-1",
          classId: "class-1",
          title: "Latino Solo",
          place: "Mikołów",
          weekday: 5,
          startTime: "18:00:00",
          participant: "Zosia Kowalska",
          paused: false,
          startedOn: "2026-09-01",
          cancelledDates: ["2026-10-09"],
        },
      ],
      extras: [
        {
          id: "slot-1",
          startsAt: "2026-10-03T15:00:00.000Z",
          title: "Lekcja indywidualna",
          place: "Lubliniec",
          detail: null,
        },
        {
          id: "series-1",
          startsAt: "2026-10-04T16:00:00.000Z",
          title: "Kurs west coast",
          place: "Mikołów",
          detail: "2/8",
        },
      ],
    });

    expect(items.map((item) => [item.title, item.cancelled, item.detail])).toEqual([
      ["Latino Solo", false, "Zosia Kowalska"],
      ["Lekcja indywidualna", false, null],
      ["Kurs west coast", false, "2/8"],
      ["Latino Solo", true, "Zosia Kowalska"],
    ]);
    expect(items[0]?.when).toBe("pt. 02.10, 18:00");
    expect(items[1]?.when).toBe("sob. 03.10, 17:00");
  });

  it("pomija terminy sprzed rozpoczęcia zapisu", () => {
    const items = buildAgenda({
      todayIso: "2026-10-02",
      dayCount: 14,
      groups: [
        {
          enrollmentId: "enr-1",
          classId: "class-1",
          title: "Latino Solo",
          place: "Mikołów",
          weekday: 5,
          startTime: "18:00",
          participant: null,
          paused: true,
          startedOn: "2026-10-08",
          cancelledDates: [],
        },
      ],
      extras: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.sortKey.startsWith("2026-10-09")).toBe(true);
    expect(items[0]?.detail).toBe("Pauza");
  });
});
