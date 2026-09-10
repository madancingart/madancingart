import { TZDate } from "@date-fns/tz";
import { addMinutes, addMonths } from "date-fns";
import { site } from "@/content/site";
import {
  classStartOnDay,
  nowInWarsaw,
  parseTimeParts,
  weekDaysFromIso,
  WARSAW_TZ,
} from "@/lib/datetime";
import { trainerShortName } from "@/lib/trainers";
import type { SlotStatus } from "@/lib/types";

const ICS_WEEKDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  rrule?: string;
  exdates?: Date[];
};

export function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

export function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function foldIcsLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

export function buildIcsCalendar(events: IcsEvent[], stamp: Date): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//M&A Dancing Art//Kalendarz//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:M&A Dancing Art",
    `X-WR-TIMEZONE:${WARSAW_TZ}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  const stampUtc = formatIcsUtc(stamp);

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stampUtc}`);
    lines.push(`DTSTART:${formatIcsUtc(event.start)}`);
    lines.push(`DTEND:${formatIcsUtc(event.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    if (event.rrule) {
      lines.push(`RRULE:${event.rrule}`);
    }
    for (const exdate of event.exdates ?? []) {
      lines.push(`EXDATE:${formatIcsUtc(exdate)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function locationLine(locationId: string | null | undefined): string {
  const location = site.locations.find((item) => item.id === locationId);
  if (!location) {
    return "";
  }
  return `${location.city}, ${location.address}`;
}

export function slotSummary(
  status: SlotStatus,
  bookingName: string | null,
  danceType: string | null,
): string {
  if (status === "blocked") {
    return "Zablokowany termin";
  }
  if (status === "booked" && bookingName) {
    return danceType
      ? `Indywidualne — ${bookingName} (${danceType})`
      : `Indywidualne — ${bookingName}`;
  }
  if (status === "booked") {
    return "Lekcja indywidualna";
  }
  return "Wolny termin indywidualny";
}

export function classRrule(weekday: number, until: Date): string {
  const day = ICS_WEEKDAY[weekday - 1] ?? "MO";
  return `FREQ=WEEKLY;BYDAY=${day};UNTIL=${formatIcsUtc(until)}`;
}

export function classOccurrenceUtc(
  weekday: number,
  startTime: string,
  durationMin: number,
  around: Date,
): { start: Date; end: Date } {
  const days = weekDaysFromIso(around.toISOString(), 0);
  const day = days[weekday - 1] ?? days[0];
  const start = classStartOnDay(day, startTime);
  const end = addMinutes(start, durationMin);
  return { start, end };
}

export function cancelledSessionUtc(
  sessionDate: string,
  startTime: string,
): Date {
  const [year, month, day] = sessionDate.split("-").map(Number);
  const { hours, minutes } = parseTimeParts(startTime);
  return new TZDate(
    year ?? 1970,
    (month ?? 1) - 1,
    day ?? 1,
    hours,
    minutes,
    WARSAW_TZ,
  );
}

export function feedWindow(now = nowInWarsaw()): { from: Date; until: Date } {
  return {
    from: addMonths(now, -1),
    until: addMonths(now, 8),
  };
}

export function personLabel(
  firstName: string,
  lastName: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export function trainerLine(trainerId: string | null): string {
  const name = trainerShortName(trainerId);
  return name ? `Trener: ${name}` : "";
}
