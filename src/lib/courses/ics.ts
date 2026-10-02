import { TZDate } from "@date-fns/tz";
import { escapeIcsText, foldIcsLine } from "@/lib/calendar/ics";
import { WARSAW_TZ } from "@/lib/datetime";

export type CourseIcsSession = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
};

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Warsaw",
  "X-LIC-LOCATION:Europe/Warsaw",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function localStamp(date: Date): string {
  const zoned = new TZDate(date, WARSAW_TZ);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${zoned.getFullYear()}${pad(zoned.getMonth() + 1)}${pad(zoned.getDate())}T${pad(zoned.getHours())}${pad(zoned.getMinutes())}${pad(zoned.getSeconds())}`;
}

export function buildCourseIcs(sessions: CourseIcsSession[], stamp: Date): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//M&A Dancing Art//Kurs//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:M&A Dancing Art",
    "X-WR-TIMEZONE:Europe/Warsaw",
    ...VTIMEZONE,
  ];
  const stampLocal = localStamp(stamp);
  for (const session of sessions) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${session.uid}`);
    lines.push(`DTSTAMP;TZID=Europe/Warsaw:${stampLocal}`);
    lines.push(`DTSTART;TZID=Europe/Warsaw:${localStamp(session.start)}`);
    lines.push(`DTEND;TZID=Europe/Warsaw:${localStamp(session.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(session.summary)}`);
    if (session.location) {
      lines.push(`LOCATION:${escapeIcsText(session.location)}`);
    }
    if (session.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(session.description)}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map((line) => foldIcsLine(line)).join("\r\n");
}
