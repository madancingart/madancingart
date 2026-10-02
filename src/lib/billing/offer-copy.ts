import { addMonths, startOfMonth } from "@/lib/billing/dates";
import type { BillingQuote } from "@/lib/billing/engine";
import { formatBillingZloty } from "@/lib/billing/status";
import { formatDayMonth, monthGenitive } from "@/lib/datetime";

export function describeFirstPayment(
  quote: BillingQuote,
  monthlyCents: number,
): string {
  if (quote.amountCents === 0) {
    return "W tym okresie nie ma zajęć do opłacenia.";
  }

  const anchor = quote.periodEnd ?? quote.periodStart;
  const nextMonth = anchor
    ? monthGenitive(addMonths(startOfMonth(anchor), 1))
    : "";
  const detail = quote.lines.join(". ");
  const monthly = formatBillingZloty(monthlyCents);
  return `Pierwsza płatność: ${formatBillingZloty(quote.amountCents)} — ${detail}. Od ${nextMonth}: ${monthly} miesięcznie, płatne do 5. dnia miesiąca.`;
}

export function describePrepaid(quote: BillingQuote): string {
  return `Przedpłata: ${formatBillingZloty(quote.amountCents)} — ${quote.lines.join(". ")}.`;
}

export function prepaidChoiceLabel(amountCents: number): string {
  return `3 miesiące z góry: ${formatBillingZloty(amountCents)}`;
}

export function passChoiceLabel(amountCents: number): string {
  return `Karnet 4 wejścia: ${formatBillingZloty(amountCents)}`;
}

export function alreadyCoveredMessage(paidUntil: string | null): string {
  if (paidUntil) {
    return `Jesteś już zapisany/a na te zajęcia — opłacone do ${formatDayMonth(paidUntil)}. Nic nie musisz robić.`;
  }
  return "Jesteś już zapisany/a na te zajęcia — karnet jest aktywny. Nic nie musisz robić.";
}

export function isEnrollmentCovered(input: {
  today: string;
  paidUntil: string | null;
  passRemaining: number;
  passValidUntil: string | null;
}): boolean {
  if (input.paidUntil && input.paidUntil >= input.today) {
    return true;
  }
  if (input.passRemaining <= 0) {
    return false;
  }
  return !input.passValidUntil || input.passValidUntil >= input.today;
}
