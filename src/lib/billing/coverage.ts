import { addDays, maxIsoDate } from "@/lib/billing/dates";

/** Okres należności, która po opłaceniu ustawia „opłacone do" na podaną datę. */
export function coverageWindow(input: {
  paidUntil: string | null;
  startedOn: string;
  until: string;
}): { periodStart: string; periodEnd: string } | { error: string } {
  const periodStart = maxIsoDate([
    input.paidUntil ? addDays(input.paidUntil, 1) : null,
    input.startedOn,
  ]);
  if (periodStart > input.until) {
    return { error: "Ta data jest wcześniejsza niż obecne opłacenie." };
  }
  return { periodStart, periodEnd: input.until };
}
