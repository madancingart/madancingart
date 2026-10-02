import { TZDate } from "@date-fns/tz";
import { WARSAW_TZ } from "@/lib/datetime";

/** Kalendarz bez strefy: same daty `YYYY-MM-DD` i dodawanie dni. */

function parts(iso: string): { year: number; month: number; day: number } {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = iso.split("-");
  return {
    year: Number.parseInt(yearPart, 10),
    month: Number.parseInt(monthPart, 10),
    day: Number.parseInt(dayPart, 10),
  };
}

function fromUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parts(iso);
  return fromUtc(new Date(Date.UTC(year, month - 1, day + days)));
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  const { year, month } = parts(iso);
  return fromUtc(new Date(Date.UTC(year, month, 0)));
}

export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parts(iso);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  const lastDay = Number(endOfMonth(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`).slice(8, 10));
  const nextDay = Math.min(day, lastDay);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

/** ISO: 1 = poniedziałek … 7 = niedziela. */
export function isoWeekday(iso: string): number {
  const { year, month, day } = parts(iso);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

export function maxIsoDate(dates: readonly (string | null | undefined)[]): string {
  const present = dates.filter((date): date is string => Boolean(date));
  const first = present[0];
  if (!first) {
    throw new Error("Brak daty.");
  }
  return present.reduce((latest, date) => (date > latest ? date : latest), first);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function zonedClock(clock: Date): { date: string; time: string } {
  const zoned = new TZDate(clock, WARSAW_TZ);
  return {
    date: `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`,
    time: `${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`,
  };
}

const TEST_TODAY = /^(\d{4}-\d{2}-\d{2})(?:[T ]([01]\d|2[0-3]):([0-5]\d))?$/;

/**
 * Dzisiejsza data i godzina w Europe/Warsaw.
 * Poza produkcją `TEST_TODAY` (`YYYY-MM-DD` albo `YYYY-MM-DDTHH:MM`) nadpisuje zegar.
 */
export function warsawNow(clock: Date = new Date()): { date: string; time: string } {
  const live = zonedClock(clock);
  const override = process.env.TEST_TODAY?.trim();
  if (process.env.NODE_ENV === "production" || !override) {
    return live;
  }
  const match = TEST_TODAY.exec(override);
  if (!match) {
    return live;
  }
  return {
    date: match[1] ?? live.date,
    time: match[2] && match[3] ? `${match[2]}:${match[3]}` : live.time,
  };
}
