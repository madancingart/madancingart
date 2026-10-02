import { TZDate } from "@date-fns/tz";
import { WARSAW_TZ, formatClock, formatDayChip, toWarsaw } from "@/lib/datetime";

export type AgendaItem = {
  id: string;
  sortKey: string;
  when: string;
  title: string;
  place: string;
  detail: string | null;
  cancelled: boolean;
};

export type GroupAgendaSource = {
  enrollmentId: string;
  classId: string;
  title: string;
  place: string;
  weekday: number;
  startTime: string;
  participant: string | null;
  paused: boolean;
  startedOn: string;
  cancelledDates: readonly string[];
};

export type TimedAgendaSource = {
  id: string;
  startsAt: string;
  title: string;
  place: string;
  detail: string | null;
};

export function addIsoDays(isoDate: string, days: number): string {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = isoDate.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${mm}-${dd}`;
}

export function isoWeekday(isoDate: string): number {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = isoDate.split("-");
  const utc = new Date(
    Date.UTC(
      Number.parseInt(yearPart, 10),
      Number.parseInt(monthPart, 10) - 1,
      Number.parseInt(dayPart, 10),
    ),
  );
  return utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
}

function datesInWindow(fromIso: string, dayCount: number): string[] {
  return Array.from({ length: dayCount }, (_, index) => addIsoDays(fromIso, index));
}

function whenOnDate(isoDate: string, time: string): string {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = isoDate.split("-");
  const day = new TZDate(
    Number.parseInt(yearPart, 10),
    Number.parseInt(monthPart, 10) - 1,
    Number.parseInt(dayPart, 10),
    12,
    0,
    WARSAW_TZ,
  );
  return `${formatDayChip(day)}, ${time.slice(0, 5)}`;
}

function groupDetail(source: GroupAgendaSource): string | null {
  const parts = [
    source.paused ? "Pauza" : null,
    source.participant,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildAgenda(input: {
  todayIso: string;
  dayCount: number;
  groups: readonly GroupAgendaSource[];
  extras: readonly TimedAgendaSource[];
}): AgendaItem[] {
  const dates = datesInWindow(input.todayIso, input.dayCount);
  const items: AgendaItem[] = [];

  for (const source of input.groups) {
    const cancelled = new Set(source.cancelledDates.map((date) => date.slice(0, 10)));
    for (const date of dates) {
      if (isoWeekday(date) !== source.weekday) {
        continue;
      }
      if (date < source.startedOn.slice(0, 10)) {
        continue;
      }
      const time = source.startTime.slice(0, 5);
      items.push({
        id: `${source.enrollmentId}:${date}`,
        sortKey: `${date}T${time}`,
        when: whenOnDate(date, time),
        title: source.title,
        place: source.place,
        detail: groupDetail(source),
        cancelled: cancelled.has(date),
      });
    }
  }

  for (const extra of input.extras) {
    const warsaw = toWarsaw(extra.startsAt);
    const year = warsaw.getFullYear();
    const month = String(warsaw.getMonth() + 1).padStart(2, "0");
    const day = String(warsaw.getDate()).padStart(2, "0");
    const time = formatClock(warsaw);
    items.push({
      id: extra.id,
      sortKey: `${year}-${month}-${day}T${time}`,
      when: `${formatDayChip(warsaw)}, ${time}`,
      title: extra.title,
      place: extra.place,
      detail: extra.detail,
      cancelled: false,
    });
  }

  return items.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
}
