const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;

export function parseYearMonth(value: string): { year: number; month: number } | null {
  if (!YEAR_MONTH.test(value)) {
    return null;
  }
  const [yearPart = "0", monthPart = "1"] = value.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  if (month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false;
  }
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = value.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/** Calendar dates in `YYYY-MM-DD` whose ISO weekday matches `weekday` (1 = Mon). */
export function classDatesInMonth(
  year: number,
  month: number,
  weekday: number,
): string[] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates: string[] = [];
  const mm = String(month).padStart(2, "0");
  for (let day = 1; day <= lastDay; day += 1) {
    const utc = new Date(Date.UTC(year, month - 1, day));
    const isoDay = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
    if (isoDay === weekday) {
      dates.push(`${year}-${mm}-${String(day).padStart(2, "0")}`);
    }
  }
  return dates;
}

export function heldClassDates(input: {
  year: number;
  month: number;
  weekday: number;
  todayIso: string;
  cancelledDates: ReadonlySet<string>;
}): string[] {
  return classDatesInMonth(input.year, input.month, input.weekday).filter(
    (date) => date <= input.todayIso && !input.cancelledDates.has(date),
  );
}
