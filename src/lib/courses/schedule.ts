import {
  addIsoDays,
  formatHm,
  isIsoDate,
  isoWeekday,
  MAX_SLOT_MIN,
  MIN_SLOT_MIN,
  parseHm,
  type GeneratedSlot,
} from "@/lib/slot-series";

export const MAX_COURSE_SESSIONS = 24;

const WEEKDAY_PLURAL = [
  "",
  "poniedziałki",
  "wtorki",
  "środy",
  "czwartki",
  "piątki",
  "soboty",
  "niedziele",
] as const;

export function generateCourseMeetings(input: {
  startDate: string;
  weekdays: number[];
  startTime: string;
  durationMin: number;
  count: number;
}): GeneratedSlot[] {
  if (!isIsoDate(input.startDate)) {
    return [];
  }
  if (input.count < 1 || input.count > MAX_COURSE_SESSIONS) {
    return [];
  }
  if (input.durationMin < MIN_SLOT_MIN || input.durationMin > MAX_SLOT_MIN) {
    return [];
  }
  const startMin = parseHm(input.startTime);
  if (startMin === null) {
    return [];
  }
  const endMin = startMin + input.durationMin;
  if (endMin > 24 * 60) {
    return [];
  }
  const days = new Set(input.weekdays.filter((day) => day >= 1 && day <= 7));
  if (days.size === 0) {
    return [];
  }

  const meetings: GeneratedSlot[] = [];
  let date = input.startDate;
  const horizon = addIsoDays(input.startDate, 366);
  while (meetings.length < input.count && date <= horizon) {
    const weekday = isoWeekday(date);
    if (days.has(weekday)) {
      meetings.push({
        date,
        weekday,
        startMin,
        endMin,
        start: formatHm(startMin),
        end: formatHm(endMin),
      });
    }
    date = addIsoDays(date, 1);
  }
  return meetings;
}

export function courseWhenLine(input: {
  count: number;
  weekdays: number[];
  startTime: string;
  firstDate: string;
}): string {
  const days = [...new Set(input.weekdays.filter((day) => day >= 1 && day <= 7))].sort(
    (left, right) => left - right,
  );
  const names = days.map((day) => WEEKDAY_PLURAL[day]).filter(Boolean);
  const dayLabel =
    names.length <= 1
      ? (names[0] ?? "terminy")
      : `${names.slice(0, -1).join(", ")} i ${names[names.length - 1]}`;
  const [year, month, day] = input.firstDate.split("-");
  const from =
    year && month && day ? `${Number(day)}.${Number(month)}` : input.firstDate;
  const time = input.startTime.slice(0, 5);
  const mod10 = input.count % 10;
  const mod100 = input.count % 100;
  const noun =
    input.count === 1
      ? "spotkanie"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "spotkania"
        : "spotkań";
  return `${input.count} ${noun} · ${dayLabel} ${time} · od ${from}`;
}

export function slugifyCourseTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
