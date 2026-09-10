const HOUR_MS = 60 * 60 * 1000;

export function msUntilStart(startsAt: Date, now: Date): number {
  return startsAt.getTime() - now.getTime();
}

/** Slot starts in 24–48 hours (exclusive of 24 h, inclusive of 48 h). */
export function isInReminderWindow(startsAt: Date, now: Date): boolean {
  const delta = msUntilStart(startsAt, now);
  return delta > 24 * HOUR_MS && delta <= 48 * HOUR_MS;
}

/** Slot starts within the next 24 hours (still in the future). */
export function isUnconfirmedUrgent(startsAt: Date, now: Date): boolean {
  const delta = msUntilStart(startsAt, now);
  return delta > 0 && delta <= 24 * HOUR_MS;
}

export function isAutoReleaseEnabled(
  value: string | undefined = process.env.AUTO_RELEASE_UNCONFIRMED,
): boolean {
  return value === "true";
}

export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function confirmationHref(token: string): string {
  return `${publicSiteUrl()}/potwierdz/${token}`;
}
