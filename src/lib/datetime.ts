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

/** Calendar date in Warsaw as `YYYY-MM-DD`. */
export function warsawTodayIso(date: Date = nowInWarsaw()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

/** ISO weekday 1 = poniedziałek … 7 = niedziela. */
export function weekdayShortLabel(weekday: number): string {
  return WEEKDAY_SHORT[weekday - 1] ?? "";
}

export function weekdayLongLabel(weekday: number): string {
  return WEEKDAY_LONG[weekday - 1] ?? "";
}

/** `16:00:00` → `16:00`. */
export function clockFromDbTime(time: string): string {
  return time.slice(0, 5);
}

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

/** e.g. „10 września 2026” from `YYYY-MM-DD`. */
export function formatDatePl(isoDate: string): string {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = isoDate.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const monthName = MONTH_GENITIVE[month - 1] ?? "";
  return `${day} ${monthName} ${year}`;
}

/** e.g. „30.09” from `YYYY-MM-DD`. */
export function formatDayMonth(isoDate: string): string {
  const [, monthPart = "01", dayPart = "01"] = isoDate.split("-");
  return `${dayPart}.${monthPart}`;
}

/** First and last calendar day of the month containing `isoDate`. */
export function warsawMonthBounds(isoDate: string): {
  from: string;
  until: string;
} {
  const [yearPart = "0", monthPart = "1"] = isoDate.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    until: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Whole days from `fromIso` to `untilIso` (`YYYY-MM-DD`). */
export function isoDateDiffDays(fromIso: string, untilIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const until = Date.parse(`${untilIso}T00:00:00Z`);
  return Math.round((until - from) / 86_400_000);
}

/** e.g. „czwartek, 10 września 2026, 16:00–16:45” */
export function formatBookingWhen(start: Date, end: Date): string {
  const isoDay = start.getDay() === 0 ? 7 : start.getDay();
  const weekday = WEEKDAY_LONG[isoDay - 1];
  const month = MONTH_GENITIVE[start.getMonth()];
  return `${weekday}, ${start.getDate()} ${month} ${start.getFullYear()}, ${formatTimeRange(start, end)}`;
}
