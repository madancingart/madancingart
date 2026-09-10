import { describe, expect, it } from "vitest";
import {
  isAutoReleaseEnabled,
  isInReminderWindow,
  isUnconfirmedUrgent,
} from "@/lib/booking/confirmation-window";

const now = new Date("2026-09-10T08:00:00+02:00");

function hoursFromNow(hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

describe("confirmation windows", () => {
  it("reminder is 24–48 h ahead", () => {
    expect(isInReminderWindow(hoursFromNow(24), now)).toBe(false);
    expect(isInReminderWindow(hoursFromNow(24.01), now)).toBe(true);
    expect(isInReminderWindow(hoursFromNow(36), now)).toBe(true);
    expect(isInReminderWindow(hoursFromNow(48), now)).toBe(true);
    expect(isInReminderWindow(hoursFromNow(48.01), now)).toBe(false);
    expect(isInReminderWindow(hoursFromNow(12), now)).toBe(false);
  });

  it("urgent unconfirmed is within 24 h and still upcoming", () => {
    expect(isUnconfirmedUrgent(hoursFromNow(24), now)).toBe(true);
    expect(isUnconfirmedUrgent(hoursFromNow(1), now)).toBe(true);
    expect(isUnconfirmedUrgent(hoursFromNow(0), now)).toBe(false);
    expect(isUnconfirmedUrgent(hoursFromNow(25), now)).toBe(false);
  });

  it("auto-release stays off unless env is exactly true", () => {
    expect(isAutoReleaseEnabled(undefined)).toBe(false);
    expect(isAutoReleaseEnabled("false")).toBe(false);
    expect(isAutoReleaseEnabled("true")).toBe(true);
  });
});
