import type { LocationId } from "@/content/site";

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
