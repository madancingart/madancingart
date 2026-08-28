import { TZDate } from "@date-fns/tz";

export const WARSAW_TZ = "Europe/Warsaw";

const WEEKDAY_SHORT = [
  "pon.",
  "wt.",
  "śr.",
  "czw.",
  "pt.",
  "sob.",
  "niedz.",
] as const;

const MONTH_SHORT = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
] as const;

export function nowInWarsaw(): TZDate {
  return TZDate.tz(WARSAW_TZ);
}

export function toWarsaw(iso: string): TZDate {
  return new TZDate(iso, WARSAW_TZ);
}

export function boundsOfWarsawDay(date: Date = nowInWarsaw()): {
  start: TZDate;
  end: TZDate;
} {
  const start = new TZDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    WARSAW_TZ,
  );
  const end = new TZDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
    WARSAW_TZ,
  );
  return { start, end };
}

export function parseTimeParts(time: string): { hours: number; minutes: number } {
  const [hoursPart = "0", minutesPart = "0"] = time.split(":");
  return {
    hours: Number.parseInt(hoursPart, 10),
    minutes: Number.parseInt(minutesPart, 10),
  };
}

export function classStartOnDay(day: Date, startTime: string): TZDate {
  const { hours, minutes } = parseTimeParts(startTime);
  return new TZDate(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours,
    minutes,
    WARSAW_TZ,
  );
}

function warsawYmd(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WARSAW_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return { year: read("year"), month: read("month"), day: read("day") };
}

function calendarDateUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Monday–Sunday of the week containing `iso`, shifted by `weekOffset` weeks. */
export function weekDaysFromIso(iso: string, weekOffset: number): TZDate[] {
  const { year, month, day } = warsawYmd(new Date(iso));
  const utc = calendarDateUtc(year, month, day);
  const sunday0 = utc.getUTCDay();
  const isoDay = sunday0 === 0 ? 7 : sunday0;
  const monday = calendarDateUtc(year, month, day - (isoDay - 1) + weekOffset * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday.getTime() + index * 86_400_000);
    return new TZDate(
      next.getUTCFullYear(),
      next.getUTCMonth(),
      next.getUTCDate(),
      12,
      0,
      WARSAW_TZ,
    );
  });
}

export function formatDayChip(day: Date): string {
  const isoDay = day.getDay() === 0 ? 7 : day.getDay();
  const dd = String(day.getDate()).padStart(2, "0");
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAY_SHORT[isoDay - 1]} ${dd}.${mm}`;
}

export function formatDayHeader(day: Date): { weekday: string; date: string } {
  const isoDay = day.getDay() === 0 ? 7 : day.getDay();
  const dd = String(day.getDate()).padStart(2, "0");
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  return {
    weekday: WEEKDAY_SHORT[isoDay - 1],
    date: `${dd}.${mm}`,
  };
}

export function formatWeekRange(start: Date, end: Date): string {
  return `${start.getDate()} ${MONTH_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTH_SHORT[end.getMonth()]} ${end.getFullYear()}`;
}

export function formatClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatClock(start)}–${formatClock(end)}`;
}

export function formatDateTimeWarsaw(iso: string): string {
  const date = toWarsaw(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}, ${formatClock(date)}`;
}

export function toDatetimeLocalValue(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T${formatClock(date)}`;
}

export function fromDatetimeLocal(value: string): TZDate {
  const [datePart = "", timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map((part) => Number(part));
  const { hours, minutes } = parseTimeParts(timePart);
  return new TZDate(year, month - 1, day, hours, minutes, WARSAW_TZ);
}

const WEEKDAY_LONG = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
] as const;

const MONTH_GENITIVE = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
] as const;

/** e.g. „czwartek, 10 września 2026, 16:00–16:45” */
export function formatBookingWhen(start: Date, end: Date): string {
  const isoDay = start.getDay() === 0 ? 7 : start.getDay();
  const weekday = WEEKDAY_LONG[isoDay - 1];
  const month = MONTH_GENITIVE[start.getMonth()];
  return `${weekday}, ${start.getDate()} ${month} ${start.getFullYear()}, ${formatTimeRange(start, end)}`;
}
