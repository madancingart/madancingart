import { TZDate } from "@date-fns/tz";
import { WARSAW_TZ } from "@/lib/datetime";

export const MAX_SERIES_MONTHS = 3;
export const MIN_SLOT_MIN = 15;
export const MAX_SLOT_MIN = 180;
export const BREAK_OPTIONS = [0, 5, 10, 15] as const;

export type SeriesWindow = {
  start: string;
  end: string;
};

export type SlotSeriesParams = {
  fromDate: string;
  toDate: string;
  weekdays: number[];
  windows: SeriesWindow[];
  durationMin: number;
  breakMin: number;
};

export type GeneratedSlot = {
  date: string;
  weekday: number;
  startMin: number;
  endMin: number;
  start: string;
  end: string;
};

export type OccupiedInterval = {
  date: string;
  startMin: number;
  endMin: number;
  label: string;
};

export type SeriesPreviewSlot = GeneratedSlot & {
  key: string;
  conflict: string | null;
};

export type SeriesClassBlock = {
  weekday: number;
  startTime: string;
  durationMin: number;
  name: string;
};

export type SeriesExistingSlot = {
  startsAt: string;
  endsAt: string;
  label?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function parseHm(value: string): number | null {
  const trimmed = value.trim().slice(0, 5);
  if (!HM_RE.test(trimmed)) {
    return null;
  }
  const [hours, minutes] = trimmed.split(":").map((part) =>
    Number.parseInt(part, 10),
  );
  return hours * 60 + minutes;
}

export function formatHm(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function isoWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(year, month - 1, day));
  const sunday0 = utc.getUTCDay();
  return sunday0 === 0 ? 7 : sunday0;
}

export function addIsoDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function eachIsoDate(fromDate: string, toDate: string): string[] {
  if (!isIsoDate(fromDate) || !isIsoDate(toDate) || fromDate > toDate) {
    return [];
  }
  const dates: string[] = [];
  let current = fromDate;
  while (current <= toDate) {
    dates.push(current);
    current = addIsoDays(current, 1);
  }
  return dates;
}

export function addMonthsIso(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(year, month - 1 + months, day));
  return utc.toISOString().slice(0, 10);
}

export function isWithinMaxRange(
  fromDate: string,
  toDate: string,
  maxMonths = MAX_SERIES_MONTHS,
): boolean {
  if (!isIsoDate(fromDate) || !isIsoDate(toDate) || fromDate > toDate) {
    return false;
  }
  return toDate <= addMonthsIso(fromDate, maxMonths);
}

export function slotKey(date: string, start: string): string {
  return `${date}T${start}`;
}

export function generateWindowStarts(
  windowStartMin: number,
  windowEndMin: number,
  durationMin: number,
  breakMin: number,
): number[] {
  if (
    durationMin < MIN_SLOT_MIN ||
    durationMin > MAX_SLOT_MIN ||
    windowEndMin <= windowStartMin ||
    breakMin < 0
  ) {
    return [];
  }
  const starts: number[] = [];
  let cursor = windowStartMin;
  while (cursor + durationMin <= windowEndMin) {
    starts.push(cursor);
    cursor += durationMin + breakMin;
  }
  return starts;
}

export function generateSlotSeries(params: SlotSeriesParams): GeneratedSlot[] {
  if (!isWithinMaxRange(params.fromDate, params.toDate)) {
    return [];
  }
  if (
    params.durationMin < MIN_SLOT_MIN ||
    params.durationMin > MAX_SLOT_MIN ||
    !BREAK_OPTIONS.includes(params.breakMin as (typeof BREAK_OPTIONS)[number])
  ) {
    return [];
  }

  const weekdaySet = new Set(
    params.weekdays.filter((day) => day >= 1 && day <= 7),
  );
  if (weekdaySet.size === 0) {
    return [];
  }

  const byKey = new Map<string, GeneratedSlot>();

  for (const date of eachIsoDate(params.fromDate, params.toDate)) {
    const weekday = isoWeekday(date);
    if (!weekdaySet.has(weekday)) {
      continue;
    }
    for (const window of params.windows) {
      const startMin = parseHm(window.start);
      const endMin = parseHm(window.end);
      if (startMin === null || endMin === null) {
        continue;
      }
      for (const slotStart of generateWindowStarts(
        startMin,
        endMin,
        params.durationMin,
        params.breakMin,
      )) {
        const slotEnd = slotStart + params.durationMin;
        const start = formatHm(slotStart);
        const key = slotKey(date, start);
        if (byKey.has(key)) {
          continue;
        }
        byKey.set(key, {
          date,
          weekday,
          startMin: slotStart,
          endMin: slotEnd,
          start,
          end: formatHm(slotEnd),
        });
      }
    }
  }

  return [...byKey.values()].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }
    return left.startMin - right.startMin;
  });
}

export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && endA > startB;
}

export function occupiedFromClasses(
  classes: SeriesClassBlock[],
  fromDate: string,
  toDate: string,
): OccupiedInterval[] {
  const occupied: OccupiedInterval[] = [];
  for (const date of eachIsoDate(fromDate, toDate)) {
    const weekday = isoWeekday(date);
    for (const item of classes) {
      if (item.weekday !== weekday) {
        continue;
      }
      const startMin = parseHm(item.startTime);
      if (startMin === null || item.durationMin <= 0) {
        continue;
      }
      occupied.push({
        date,
        startMin,
        endMin: startMin + item.durationMin,
        label: `${item.name} ${formatHm(startMin)}`,
      });
    }
  }
  return occupied;
}

export function occupiedFromTrainerSlots(
  slots: SeriesExistingSlot[],
): OccupiedInterval[] {
  return slots.flatMap((slot) => {
    const start = new TZDate(slot.startsAt, WARSAW_TZ);
    const end = new TZDate(slot.endsAt, WARSAW_TZ);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [];
    }
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    if (endMin <= startMin) {
      return [];
    }
    return [
      {
        date,
        startMin,
        endMin,
        label: slot.label ?? `istniejący termin ${formatHm(startMin)}`,
      },
    ];
  });
}

export function applyCollisions(
  slots: GeneratedSlot[],
  occupied: OccupiedInterval[],
): SeriesPreviewSlot[] {
  const byDate = new Map<string, OccupiedInterval[]>();
  for (const block of occupied) {
    const list = byDate.get(block.date) ?? [];
    list.push(block);
    byDate.set(block.date, list);
  }

  return slots.map((slot) => {
    const hit = (byDate.get(slot.date) ?? []).find((block) =>
      intervalsOverlap(slot.startMin, slot.endMin, block.startMin, block.endMin),
    );
    return {
      ...slot,
      key: slotKey(slot.date, slot.start),
      conflict: hit ? `koliduje: ${hit.label}` : null,
    };
  });
}

export function polishCreateSlotsLabel(count: number): string {
  if (count === 1) {
    return "Utwórz 1 termin";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `Utwórz ${count} terminy`;
  }
  return `Utwórz ${count} terminów`;
}
