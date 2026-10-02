import { addDays, addMonths, startOfMonth } from "@/lib/billing/dates";

/** Data wystawienia. Pusty miesiąc nie ma jej w silniku — tu ta sama reguła co przy zajęciach. */
export function naturalIssueOn(quote: {
  issueOn: string | null;
  periodStart: string | null;
}): string | null {
  if (quote.issueOn) {
    return quote.issueOn;
  }
  if (!quote.periodStart) {
    return null;
  }
  if (quote.periodStart.slice(8, 10) === "01") {
    return `${addMonths(startOfMonth(quote.periodStart), -1).slice(0, 7)}-20`;
  }
  return addDays(quote.periodStart, -10);
}

export function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** −2…+2, stałe dla tego samego zapisu. */
export function issueDayOffset(enrollmentId: string): number {
  return (stableHash(enrollmentId) % 5) - 2;
}

export function shouldSpreadIssues(emailsOnTwentieth: number): boolean {
  return emailsOnTwentieth > 80;
}

/** Przesuwa tylko wystawienie 20. dnia, gdy dobowa pula maili tego wymaga. */
export function effectiveIssueOn(
  issueOn: string,
  enrollmentId: string,
  spread: boolean,
): string {
  if (!spread || issueOn.slice(8, 10) !== "20") {
    return issueOn;
  }
  return addDays(issueOn, issueDayOffset(enrollmentId));
}
