import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

const TOKEN_BYTES = 24;

export function getCalendarFeedToken(): string {
  const fromEnv = process.env.CALENDAR_ICS_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return createHash("sha256")
    .update(`madancingart-ical-v1:${getSupabaseServiceRoleKey()}`)
    .digest("base64url")
    .slice(0, TOKEN_BYTES);
}

export function calendarFeedTokensMatch(
  given: string,
  expected: string,
): boolean {
  const left = Buffer.from(given, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return timingSafeEqual(left, right);
}
