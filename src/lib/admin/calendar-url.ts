import type { LocationId } from "@/content/site";
import { weekDaysFromIso } from "@/lib/datetime";

export type AdminKindFilter = "all" | "slot" | "class";

export type AdminCalendarQuery = {
  locationId: LocationId;
  weekOffset?: number;
  trainer?: string | null;
  kind?: AdminKindFilter;
  nowy?: "slot" | null;
};

export function parseKindFilter(value: string | undefined): AdminKindFilter {
  if (value === "indywidualne") {
    return "slot";
  }
  if (value === "grupowe") {
    return "class";
  }
  return "all";
}

export function parseTrainerFilter(value: string | undefined): string | null {
  if (!value || value === "wszyscy") {
    return null;
  }
  return value;
}

export function adminCalendarHref(query: AdminCalendarQuery): string {
  const params = new URLSearchParams();
  params.set("lokalizacja", query.locationId);
  if (query.weekOffset && query.weekOffset !== 0) {
    params.set("tydzien", String(query.weekOffset));
  }
  if (query.trainer) {
    params.set("trener", query.trainer);
  }
  if (query.kind === "slot") {
    params.set("typ", "indywidualne");
  }
  if (query.kind === "class") {
    params.set("typ", "grupowe");
  }
  if (query.nowy === "slot") {
    params.set("nowy", "slot");
  }
  return `/admin/kalendarz?${params.toString()}`;
}

/** Week offset of `targetIso` relative to the week containing `nowIso` (Warsaw). */
export function weekOffsetFromIso(targetIso: string, nowIso: string): number {
  const targetMonday = weekDaysFromIso(targetIso, 0)[0];
  const nowMonday = weekDaysFromIso(nowIso, 0)[0];
  if (!targetMonday || !nowMonday) {
    return 0;
  }
  const diffMs =
    Date.UTC(
      targetMonday.getFullYear(),
      targetMonday.getMonth(),
      targetMonday.getDate(),
    ) -
    Date.UTC(nowMonday.getFullYear(), nowMonday.getMonth(), nowMonday.getDate());
  return Math.round(diffMs / (7 * 86_400_000));
}
