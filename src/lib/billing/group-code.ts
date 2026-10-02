const WEEKDAY_CODE = ["PN", "WT", "SR", "CZ", "PT", "SO", "ND"] as const;

export type GroupCodeInput = {
  id: string;
  locationId: string;
  weekday: number;
  startTime: string;
  slug: string;
};

export function groupCode(input: {
  locationId: string;
  weekday: number;
  startTime: string;
  slug: string;
}): string {
  const location = input.locationId === "lubliniec" ? "LUB" : "MIK";
  const day = WEEKDAY_CODE[input.weekday - 1] ?? "XX";
  const time = input.startTime.slice(0, 5).replace(":", "");
  const slug = input.slug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 16);
  return `${location}-${day}-${time}-${slug || "GRUPA"}`;
}

/** Czytelne kody. Przy kolizji dopisuje krótki sufiks z id. */
export function assignGroupCodes(
  groups: readonly GroupCodeInput[],
): Map<string, string> {
  const codes = new Map<string, string>();
  const used = new Map<string, number>();
  const ordered = [...groups].sort((left, right) => left.id.localeCompare(right.id));
  for (const group of ordered) {
    const base = groupCode(group);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    codes.set(group.id, seen === 0 ? base : `${base}-${seen + 1}`);
  }
  return codes;
}
