import { addDays, addMonths, endOfMonth, isoWeekday, maxIsoDate, startOfMonth } from "@/lib/billing/dates";

/**
 * Jedyne miejsce, które liczy kwoty należności.
 * Bez bazy i bez odczytu zegara — data i godzina wchodzą parametrem.
 */

export type BillingClass = {
  weekday: number;
  startTime: string;
};

export type BillingKind =
  | "first"
  | "monthly"
  | "prepaid"
  | "pass4"
  | "skip"
  | "manual";

export type BillingQuote = {
  kind: BillingKind;
  amountCents: number;
  periodStart: string | null;
  periodEnd: string | null;
  sessionDates: string[];
  issueOn: string | null;
  dueOn: string | null;
  lines: string[];
};

export type PrepaidPromo = {
  amountCents: number;
  label: string;
};

const MONTH_LOCATIVE = [
  "styczniu",
  "lutym",
  "marcu",
  "kwietniu",
  "maju",
  "czerwcu",
  "lipcu",
  "sierpniu",
  "wrześniu",
  "październiku",
  "listopadzie",
  "grudniu",
] as const;

export function rate(monthlyCents: number): number {
  return Math.round(monthlyCents / 4);
}

export function prorated(sessionCount: number, monthlyCents: number): number {
  return Math.min(sessionCount * rate(monthlyCents), monthlyCents);
}

export function sessions(
  cls: BillingClass,
  from: string,
  to: string,
  options: {
    cancelled?: readonly string[];
    nowDate?: string;
    nowTime?: string;
  } = {},
): string[] {
  if (from > to) {
    return [];
  }

  const startTime = cls.startTime.slice(0, 5);
  const cancelled = new Set((options.cancelled ?? []).map((date) => date.slice(0, 10)));
  const dates: string[] = [];
  let cursor = from;

  while (cursor <= to) {
    const beforeToday = options.nowDate !== undefined && cursor < options.nowDate;
    const alreadyStarted =
      options.nowDate !== undefined &&
      options.nowTime !== undefined &&
      cursor === options.nowDate &&
      options.nowTime >= startTime;
    if (
      !beforeToday &&
      !alreadyStarted &&
      isoWeekday(cursor) === cls.weekday &&
      !cancelled.has(cursor)
    ) {
      dates.push(cursor);
    }
    const next = addDays(cursor, 1);
    if (next <= cursor) {
      break;
    }
    cursor = next;
  }

  return dates;
}

function zloty(cents: number): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const grosz = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  if (grosz === 0) {
    return `${sign}${whole} zł`;
  }
  return `${sign}${whole},${String(grosz).padStart(2, "0")} zł`;
}

function dayMonth(iso: string): string {
  return `${Number.parseInt(iso.slice(8, 10), 10)}.${iso.slice(5, 7)}`;
}

function monthLocative(iso: string): string {
  const month = Number.parseInt(iso.slice(5, 7), 10);
  return MONTH_LOCATIVE[month - 1] ?? "";
}

function countPhrase(count: number): string {
  if (count === 1) {
    return "1 zajęcie";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} zajęcia`;
  }
  return `${count} zajęć`;
}

function describeSessions(
  dates: readonly string[],
  monthlyCents: number,
  chargedCents: number,
): string {
  const first = dates[0];
  if (!first) {
    return "Brak zajęć";
  }
  const listed = dates.map(dayMonth).join(", ");
  const phrase = `${countPhrase(dates.length)} w ${monthLocative(first)} (${listed})`;
  const perSession = rate(monthlyCents);
  if (chargedCents === dates.length * perSession) {
    return `${phrase} × ${zloty(perSession)}`;
  }
  return `${phrase} — ${zloty(chargedCents)}`;
}

function emptyMonthLine(iso: string): string {
  return `Brak zajęć w ${monthLocative(iso)}`;
}

export function quoteFirst(
  cls: BillingClass,
  monthlyCents: number,
  today: string,
  nowTime: string,
  cancelled: readonly string[] = [],
): BillingQuote {
  const monthEnd = endOfMonth(today);
  const s1 = sessions(cls, today, monthEnd, {
    cancelled,
    nowDate: today,
    nowTime,
  });

  if (s1.length >= 2) {
    const amountCents = prorated(s1.length, monthlyCents);
    return {
      kind: "first",
      amountCents,
      periodStart: today,
      periodEnd: monthEnd,
      sessionDates: s1,
      issueOn: today,
      dueOn: addDays(today, 4),
      lines: [describeSessions(s1, monthlyCents, amountCents)],
    };
  }

  const nextStart = addMonths(startOfMonth(today), 1);
  const nextEnd = endOfMonth(nextStart);
  const s2 = sessions(cls, nextStart, nextEnd, { cancelled });
  const firstPart = prorated(s1.length, monthlyCents);
  const secondPart = s2.length > 0 ? monthlyCents : 0;
  const lines = [
    s1.length > 0 ? describeSessions(s1, monthlyCents, firstPart) : null,
    s2.length > 0 ? describeSessions(s2, monthlyCents, secondPart) : emptyMonthLine(nextStart),
  ].filter((line): line is string => Boolean(line));

  return {
    kind: "first",
    amountCents: firstPart + secondPart,
    periodStart: today,
    periodEnd: nextEnd,
    sessionDates: [...s1, ...s2],
    issueOn: today,
    dueOn: addDays(today, 4),
    lines,
  };
}

export function quoteNextMonthly(
  cls: BillingClass,
  monthlyCents: number,
  paidUntil: string | null,
  billingStart: string,
  cancelled: readonly string[] = [],
): BillingQuote {
  const start = maxIsoDate([
    paidUntil ? addDays(paidUntil, 1) : null,
    billingStart,
  ]);
  const end = endOfMonth(start);
  const held = sessions(cls, start, end, { cancelled });

  if (held.length === 0) {
    return {
      kind: "skip",
      amountCents: 0,
      periodStart: start,
      periodEnd: end,
      sessionDates: [],
      issueOn: null,
      dueOn: null,
      lines: [emptyMonthLine(start)],
    };
  }

  const fullMonth = start.slice(8, 10) === "01";
  const amountCents = fullMonth ? monthlyCents : prorated(held.length, monthlyCents);
  const issueOn = fullMonth
    ? `${addMonths(startOfMonth(start), -1).slice(0, 7)}-20`
    : addDays(start, -10);

  return {
    kind: "monthly",
    amountCents,
    periodStart: start,
    periodEnd: end,
    sessionDates: held,
    issueOn,
    dueOn: addDays(start, 4),
    lines: [describeSessions(held, monthlyCents, amountCents)],
  };
}

export function quotePrepaid(
  cls: BillingClass,
  monthlyCents: number,
  months: number,
  paidUntil: string | null,
  billingStart: string,
  today: string,
  promo?: PrepaidPromo,
  cancelled: readonly string[] = [],
): BillingQuote {
  const start = maxIsoDate([
    paidUntil ? addDays(paidUntil, 1) : null,
    today,
    billingStart,
  ]);

  if (promo) {
    const periodEnd = addDays(addMonths(start, months), -1);
    const sessionDates = sessions(cls, start, periodEnd, { cancelled });
    return {
      kind: "prepaid",
      amountCents: promo.amountCents,
      periodStart: start,
      periodEnd,
      sessionDates,
      issueOn: today,
      dueOn: addDays(today, 4),
      lines: [promo.label],
    };
  }

  const parts: BillingQuote[] = [];
  let cursor = start;
  for (let index = 0; index < months; index += 1) {
    const part = quoteNextMonthly(
      cls,
      monthlyCents,
      addDays(cursor, -1),
      cursor,
      cancelled,
    );
    parts.push(part);
    if (!part.periodEnd) {
      break;
    }
    cursor = addDays(part.periodEnd, 1);
  }

  const periodEnd = parts.at(-1)?.periodEnd ?? start;
  return {
    kind: "prepaid",
    amountCents: parts.reduce((sum, part) => sum + part.amountCents, 0),
    periodStart: parts[0]?.periodStart ?? start,
    periodEnd,
    sessionDates: parts.flatMap((part) => part.sessionDates),
    issueOn: parts.find((part) => part.issueOn)?.issueOn ?? null,
    dueOn: parts.find((part) => part.dueOn)?.dueOn ?? null,
    lines: parts.flatMap((part) => part.lines),
  };
}

export function quotePass(priceItem: {
  amountCents: number;
  label: string;
  detail?: string;
}): BillingQuote {
  const name = priceItem.detail
    ? `${priceItem.label}, ${priceItem.detail}`
    : priceItem.label;
  return {
    kind: "pass4",
    amountCents: priceItem.amountCents,
    periodStart: null,
    periodEnd: null,
    sessionDates: [],
    issueOn: null,
    dueOn: null,
    lines: [`Karnet: ${name} — ${zloty(priceItem.amountCents)}`],
  };
}
