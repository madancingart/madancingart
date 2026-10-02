import { TZDate } from "@date-fns/tz";
import { warsawNow } from "@/lib/billing/dates";
import { WARSAW_TZ } from "@/lib/datetime";

export type BillingMode = "off" | "dry-run" | "live";

export function parseBillingMode(value: string | undefined): BillingMode {
  const trimmed = value?.trim();
  if (trimmed === "dry-run" || trimmed === "live") {
    return trimmed;
  }
  return "off";
}

export function billingMode(): BillingMode {
  return parseBillingMode(process.env.BILLING_MODE);
}

/** Północ podanej daty kalendarzowej w Europe/Warsaw, jako ISO UTC. */
export function warsawStartIso(isoDate: string): string {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = isoDate.split("-");
  const zoned = new TZDate(
    Number.parseInt(yearPart, 10),
    Number.parseInt(monthPart, 10) - 1,
    Number.parseInt(dayPart, 10),
    0,
    0,
    0,
    WARSAW_TZ,
  );
  return new Date(zoned.getTime()).toISOString();
}

/**
 * Data rozliczenia w Warszawie i chwila do porównań z timestamptz.
 * Poza produkcją `TEST_TODAY` przesuwa obie. W produkcji chwila to zegar wywołania.
 */
export function dailyClock(clock: Date = new Date()): { today: string; now: Date } {
  const zoned = warsawNow(clock);
  const override = process.env.TEST_TODAY?.trim();
  if (process.env.NODE_ENV === "production" || !override) {
    return { today: zoned.date, now: clock };
  }
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = zoned.date.split("-");
  const [hourPart = "0", minutePart = "0"] = zoned.time.split(":");
  const now = new TZDate(
    Number.parseInt(yearPart, 10),
    Number.parseInt(monthPart, 10) - 1,
    Number.parseInt(dayPart, 10),
    Number.parseInt(hourPart, 10),
    Number.parseInt(minutePart, 10),
    0,
    WARSAW_TZ,
  );
  return { today: zoned.date, now };
}
