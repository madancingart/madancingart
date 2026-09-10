import { priceAmountCents } from "@/content/pricing";
import type { LocationId } from "@/content/site";
import type { GroupPassKind } from "@/lib/membership-status";

export type GroupPassSuggestion = {
  kind: GroupPassKind;
  label: string;
  amountCents: number | null;
};

const KIND_LABEL: Record<GroupPassKind, string> = {
  monthly: "Miesięczny",
  pass_4: "Karnet 4 wejścia",
  pass_8: "Karnet 8 wejść",
};

function cents(id: string): number | null {
  return priceAmountCents(id);
}

function latinoLubliniecPass4(durationMin: number): number | null {
  return durationMin <= 60
    ? cents("lubliniec-latino-4x-60")
    : cents("lubliniec-latino-4x-75");
}

function uzytkowyMikolowMonthly(durationMin: number): number | null {
  return durationMin <= 50
    ? cents("mikolow-uzytkowy-50")
    : cents("mikolow-uzytkowy-75");
}

function uzytkowyLubliniecPass4(durationMin: number): number | null {
  return durationMin <= 60
    ? cents("lubliniec-uzytkowy-4x-60")
    : cents("lubliniec-uzytkowy-4x-75");
}

function uzytkowyLubliniecPass8(durationMin: number): number | null {
  return durationMin > 60 ? cents("lubliniec-promo-75-8") : null;
}

export function suggestedGroupPassCents(input: {
  locationId: LocationId;
  classSlug: string;
  durationMin: number;
  kind: GroupPassKind;
}): number | null {
  const { locationId, classSlug, durationMin, kind } = input;
  const isChild =
    classSlug === "dzieci-4-7" || classSlug === "dzieci-8-14";

  if (isChild && kind === "monthly") {
    return locationId === "lubliniec"
      ? cents("lubliniec-dzieci-mies")
      : cents("mikolow-dzieci-mies");
  }

  if (classSlug === "latino-solo") {
    if (locationId === "mikolow" && kind === "monthly") {
      return cents("mikolow-latino-mies");
    }
    if (locationId === "lubliniec" && kind === "pass_4") {
      return latinoLubliniecPass4(durationMin);
    }
  }

  if (classSlug === "taniec-uzytkowy") {
    if (locationId === "mikolow" && kind === "monthly") {
      return uzytkowyMikolowMonthly(durationMin);
    }
    if (locationId === "lubliniec" && kind === "pass_4") {
      return uzytkowyLubliniecPass4(durationMin);
    }
    if (locationId === "lubliniec" && kind === "pass_8") {
      return uzytkowyLubliniecPass8(durationMin);
    }
  }

  return null;
}

export function groupPassSuggestions(input: {
  locationId: LocationId;
  classSlug: string;
  durationMin: number;
}): GroupPassSuggestion[] {
  return (["monthly", "pass_4", "pass_8"] as const).map((kind) => ({
    kind,
    label: KIND_LABEL[kind],
    amountCents: suggestedGroupPassCents({ ...input, kind }),
  }));
}

export function groupPassDbLabel(
  kind: GroupPassKind,
  className: string,
): string {
  if (kind === "monthly") {
    return `Karnet miesięczny — ${className}`;
  }
  if (kind === "pass_4") {
    return `Karnet 4 wejścia — ${className}`;
  }
  return `Karnet 8 wejść — ${className}`;
}

export function groupPassTotalLessons(kind: GroupPassKind): number | null {
  if (kind === "monthly") {
    return null;
  }
  return kind === "pass_4" ? 4 : 8;
}
