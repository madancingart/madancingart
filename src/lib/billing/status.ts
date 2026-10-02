import { TZDate } from "@date-fns/tz";
import { WARSAW_TZ, formatClock, isoDateDiffDays } from "@/lib/datetime";
import type { EnrollmentBillingMode, EnrollmentStatus } from "@/lib/types";

/**
 * Jedno miejsce na kolor statusu zapisu.
 * Panel klienta i (w kolejnym kroku) panel admina biorą stąd ten sam wynik.
 *
 * Kolejność:
 * 1. pending
 * 2. otwarta należność po terminie → red
 * 3. otwarta należność w terminie → amber
 * 4. pass4 bez karnetu i bez pokrycia okresem → red
 * 5. pass4 z jednym wejściem → amber
 * 6. pass4 z ważnym karnetem → green
 * 7. paid_until w ciągu 7 dni bez kolejnej opłaconej należności → amber
 * 8. green
 */

export type BillingTone = "red" | "amber" | "pending" | "green";

export type BillingReason =
  | "pending"
  | "overdue"
  | "open"
  | "pass_uncovered"
  | "pass_low"
  | "pass_ok"
  | "ending"
  | "paid"
  | "clear";

export type BillingCharge = {
  status: "open" | "paid" | "void";
  dueDate: string;
  amountCents: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type BillingPass = {
  remaining: number;
  total: number;
  validUntil: string | null;
};

export type BillingStatusInput = {
  today: string;
  enrollmentStatus: EnrollmentStatus;
  billingMode: EnrollmentBillingMode;
  paidUntil: string | null;
  holdExpiresAt: string | null;
  charges: readonly BillingCharge[];
  pass: BillingPass | null;
};

export type BillingStatus = {
  tone: BillingTone;
  reason: BillingReason;
  label: string;
};

const ENDING_DAYS = 7;

const MONTH_NOMINATIVE = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
] as const;

export function formatBillingZloty(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const abs = Math.abs(amountCents);
  const zloty = Math.floor(abs / 100);
  const grosze = abs % 100;
  if (grosze === 0) {
    return `${sign}${zloty} zł`;
  }
  return `${sign}${zloty},${String(grosze).padStart(2, "0")} zł`;
}

export function monthNominative(isoDate: string | null): string | null {
  if (!isoDate || isoDate.length < 7) {
    return null;
  }
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  return MONTH_NOMINATIVE[month - 1] ?? null;
}

export function arrearsLine(amountCents: number, context: string): string {
  return `Zaległa płatność: ${formatBillingZloty(amountCents)} (${context})`;
}

export function pickPayableCharge<T extends Pick<BillingCharge, "status" | "dueDate">>(
  charges: readonly T[],
  today: string,
): T | null {
  const open = charges.filter((charge) => charge.status === "open");
  const overdue = open
    .filter((charge) => charge.dueDate < today)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  if (overdue[0]) {
    return overdue[0];
  }
  const upcoming = open
    .filter((charge) => charge.dueDate >= today)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  return upcoming[0] ?? null;
}

function dayMonth(isoDate: string): string {
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  const day = Number.parseInt(isoDate.slice(8, 10), 10);
  return `${day}.${month}`;
}

function paidUntilLabel(paidUntil: string): string {
  return `Opłacone do ${dayMonth(paidUntil)}`;
}

function zostalo(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "Zostały";
  }
  return "Zostało";
}

function passLabel(pass: BillingPass): string {
  const until = pass.validUntil ? `, ważny do ${dayMonth(pass.validUntil)}` : "";
  return `${zostalo(pass.remaining)} ${pass.remaining} z ${pass.total} wejść${until}`;
}

function holdLabel(holdExpiresAt: string | null): string {
  if (!holdExpiresAt) {
    return "Miejsce czeka na opłacenie — opłać, żeby je potwierdzić";
  }
  const date = new TZDate(holdExpiresAt, WARSAW_TZ);
  if (Number.isNaN(date.getTime())) {
    return "Miejsce czeka na opłacenie — opłać, żeby je potwierdzić";
  }
  const stamp = `${date.getDate()}.${date.getMonth() + 1}, ${formatClock(date)}`;
  return `Miejsce czeka do ${stamp} — opłać, żeby je potwierdzić`;
}

function activePass(pass: BillingPass | null, today: string): BillingPass | null {
  if (!pass || pass.remaining <= 0) {
    return null;
  }
  if (pass.validUntil && pass.validUntil < today) {
    return null;
  }
  return pass;
}

function hasPeriodCoverage(
  paidUntil: string | null,
  charges: readonly BillingCharge[],
  today: string,
): boolean {
  if (paidUntil && paidUntil >= today) {
    return true;
  }
  return charges.some((charge) => {
    if (charge.status !== "paid" || !charge.periodStart) {
      return false;
    }
    if (charge.periodStart > today) {
      return false;
    }
    if (charge.periodEnd && charge.periodEnd < today) {
      return false;
    }
    return true;
  });
}

function hasNextPaidCharge(
  charges: readonly BillingCharge[],
  paidUntil: string,
): boolean {
  return charges.some(
    (charge) =>
      charge.status === "paid" &&
      charge.periodStart !== null &&
      charge.periodStart > paidUntil,
  );
}

export function billingStatus(input: BillingStatusInput): BillingStatus {
  if (input.enrollmentStatus === "pending") {
    return {
      tone: "pending",
      reason: "pending",
      label: holdLabel(input.holdExpiresAt),
    };
  }

  const open = input.charges.filter((charge) => charge.status === "open");
  const overdue = open
    .filter((charge) => charge.dueDate < input.today)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const overdueCharge = overdue[0];
  if (overdueCharge) {
    return {
      tone: "red",
      reason: "overdue",
      label: `Zaległość ${formatBillingZloty(overdueCharge.amountCents)}`,
    };
  }

  const due = open
    .filter((charge) => charge.dueDate >= input.today)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const openCharge = due[0];
  if (openCharge) {
    return {
      tone: "amber",
      reason: "open",
      label: `Do zapłaty ${formatBillingZloty(openCharge.amountCents)} do ${dayMonth(openCharge.dueDate)}`,
    };
  }

  const pass =
    input.billingMode === "pass4" ? activePass(input.pass, input.today) : null;

  if (
    input.billingMode === "pass4" &&
    !pass &&
    !hasPeriodCoverage(input.paidUntil, input.charges, input.today)
  ) {
    return {
      tone: "red",
      reason: "pass_uncovered",
      label: "Brak ważnego karnetu",
    };
  }

  if (pass && pass.remaining === 1) {
    return {
      tone: "amber",
      reason: "pass_low",
      label: passLabel(pass),
    };
  }

  if (pass) {
    return {
      tone: "green",
      reason: "pass_ok",
      label: passLabel(pass),
    };
  }

  if (input.paidUntil) {
    const daysLeft = isoDateDiffDays(input.today, input.paidUntil);
    if (
      daysLeft >= 0 &&
      daysLeft <= ENDING_DAYS &&
      !hasNextPaidCharge(input.charges, input.paidUntil)
    ) {
      return {
        tone: "amber",
        reason: "ending",
        label: paidUntilLabel(input.paidUntil),
      };
    }
    if (daysLeft >= 0) {
      return {
        tone: "green",
        reason: "paid",
        label: paidUntilLabel(input.paidUntil),
      };
    }
  }

  return {
    tone: "green",
    reason: "clear",
    label: "Bez zaległości",
  };
}

const TONE_RANK: Record<BillingTone, number> = {
  red: 0,
  amber: 1,
  pending: 2,
  green: 3,
};

export function worstBillingStatus(items: readonly BillingStatus[]): BillingStatus {
  const first = items[0];
  if (!first) {
    return { tone: "green", reason: "clear", label: "Bez zaległości" };
  }
  return items.reduce((worst, next) =>
    TONE_RANK[next.tone] < TONE_RANK[worst.tone] ? next : worst,
  );
}

export function chargeStatusPill(
  status: "open" | "paid" | "void",
  dueDate: string,
  today: string,
): BillingStatus {
  if (status === "void") {
    return { tone: "pending", reason: "clear", label: "Anulowana" };
  }
  if (status === "paid") {
    return { tone: "green", reason: "paid", label: "Opłacona" };
  }
  if (dueDate < today) {
    return { tone: "red", reason: "overdue", label: "Zaległa" };
  }
  return { tone: "amber", reason: "open", label: "Do zapłaty" };
}

export function reminderStageLabel(stage: number): string {
  if (stage <= 0) {
    return "brak";
  }
  if (stage === 1) {
    return "wystawiona";
  }
  if (stage === 2) {
    return "przed terminem";
  }
  if (stage === 3) {
    return "zaległość";
  }
  return "ostatnie";
}

export const GROUP_PASS_KINDS = ["monthly", "pass_4", "pass_8"] as const;

export type GroupPassKind = (typeof GROUP_PASS_KINDS)[number];

export function isGroupPassKind(kind: string): kind is GroupPassKind {
  return GROUP_PASS_KINDS.includes(kind as GroupPassKind);
}

export function remainingEntriesLabel(count: number): string {
  if (count === 1) {
    return "zostało 1 wejście";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `zostały ${count} wejścia`;
  }
  return `zostało ${count} wejść`;
}

export function isCoveringDate(
  todayIso: string,
  validFrom: string | null,
  validUntil: string | null,
): boolean {
  if (validFrom && todayIso < validFrom) {
    return false;
  }
  if (validUntil && todayIso > validUntil) {
    return false;
  }
  return true;
}
