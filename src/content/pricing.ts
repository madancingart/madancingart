import type { LocationId } from "@/content/site";

export type PriceUnit = "os/mies" | "para/mies" | "os" | "para" | "h" | "pakiet";

export type PriceBilling = "monthly" | "pass4" | "one-off";

export type PriceItem = {
  id: string;
  label: string;
  detail?: string;
  amountCents: number;
  unit: PriceUnit;
  note?: string;
  billing: PriceBilling;
  /** Przedpłata z promocji. Bot skleja ten okres zamiast liczyć miesiące osobno. */
  prepaid?: { months: 3; amountCents: number; label: string };
};

export type PricingSection = {
  title: string;
  items: PriceItem[];
};

export const pricing: Record<LocationId, PricingSection[]> = {
  mikolow: [
    {
      title: "Zajęcia dla dzieci",
      items: [
        {
          id: "mikolow-dzieci-mies",
          label: "Zajęcia miesięczne",
          detail: "45 min",
          amountCents: 13_000,
          unit: "os/mies",
          billing: "monthly",
        },
      ],
    },
    {
      title: "Latino solo",
      items: [
        {
          id: "mikolow-latino-mies",
          label: "Zajęcia miesięczne",
          detail: "50 min",
          amountCents: 12_000,
          unit: "os/mies",
          billing: "monthly",
        },
      ],
    },
    {
      title: "Taniec użytkowy",
      items: [
        {
          id: "mikolow-uzytkowy-50",
          label: "Zajęcia miesięczne",
          detail: "50 min",
          amountCents: 24_000,
          unit: "para/mies",
          billing: "monthly",
        },
        {
          id: "mikolow-uzytkowy-75",
          label: "Zajęcia miesięczne",
          detail: "1 h 15 min",
          amountCents: 36_000,
          unit: "para/mies",
          billing: "monthly",
        },
      ],
    },
    {
      title: "Lekcje indywidualne",
      items: [
        {
          id: "mikolow-ind-1h",
          label: "1 h",
          amountCents: 15_000,
          unit: "h",
          billing: "one-off",
        },
        {
          id: "mikolow-ind-6h",
          label: "Pakiet 6 h",
          amountCents: 80_000,
          unit: "pakiet",
          billing: "one-off",
        },
        {
          id: "mikolow-ind-10h",
          label: "Pakiet 10 h",
          amountCents: 120_000,
          unit: "pakiet",
          billing: "one-off",
        },
      ],
    },
  ],
  lubliniec: [
    {
      title: "Zajęcia dla dzieci",
      items: [
        {
          id: "lubliniec-dzieci-mies",
          label: "Zajęcia miesięczne",
          amountCents: 13_000,
          unit: "os/mies",
          billing: "monthly",
        },
      ],
    },
    {
      title: "Latino solo",
      items: [
        {
          id: "lubliniec-latino-4x-60",
          label: "4 wejścia",
          detail: "1 h",
          amountCents: 12_000,
          unit: "os",
          billing: "pass4",
        },
        {
          id: "lubliniec-latino-4x-75",
          label: "4 wejścia",
          detail: "1 h 15 min",
          amountCents: 18_000,
          unit: "os",
          billing: "pass4",
        },
      ],
    },
    {
      title: "Taniec użytkowy",
      items: [
        {
          id: "lubliniec-uzytkowy-4x-60",
          label: "4 wejścia",
          detail: "1 h",
          amountCents: 24_000,
          unit: "para",
          billing: "pass4",
        },
        {
          id: "lubliniec-uzytkowy-4x-75",
          label: "4 wejścia",
          detail: "1 h 15 min",
          amountCents: 36_000,
          unit: "para",
          billing: "pass4",
        },
      ],
    },
    {
      title: "Lekcje indywidualne",
      items: [
        {
          id: "lubliniec-ind-1h",
          label: "1 h",
          amountCents: 15_000,
          unit: "h",
          billing: "one-off",
        },
        {
          id: "lubliniec-ind-6h",
          label: "Pakiet 6 h",
          amountCents: 80_000,
          unit: "pakiet",
          billing: "one-off",
        },
        {
          id: "lubliniec-ind-10h",
          label: "Pakiet 10 h",
          amountCents: 120_000,
          unit: "pakiet",
          billing: "one-off",
        },
      ],
    },
    {
      title: "Promocja — taniec użytkowy",
      items: [
        {
          id: "lubliniec-promo-75-4",
          label: "4 wejścia",
          detail: "1 h 15 min",
          amountCents: 36_000,
          unit: "para",
          billing: "pass4",
        },
        {
          id: "lubliniec-promo-75-8",
          label: "8 wejść",
          detail: "1 h 15 min",
          amountCents: 72_000,
          unit: "para",
          billing: "one-off",
        },
        {
          id: "lubliniec-promo-75-3m-1x",
          label: "3 miesiące, 1×/tydz.",
          detail: "1 h 15 min",
          amountCents: 95_000,
          unit: "para",
          billing: "monthly",
          prepaid: {
            months: 3,
            amountCents: 95_000,
            label: "3 miesiące 1×/tydz. — promocja",
          },
        },
        {
          id: "lubliniec-promo-75-3m-2x",
          label: "3 miesiące, 2×/tydz.",
          detail: "1 h 15 min",
          amountCents: 190_000,
          unit: "para",
          billing: "one-off",
        },
        {
          id: "lubliniec-promo-60-4",
          label: "4 wejścia",
          detail: "1 h",
          amountCents: 24_000,
          unit: "para",
          billing: "pass4",
        },
        {
          id: "lubliniec-promo-60-3m",
          label: "3 miesiące",
          detail: "1 h",
          amountCents: 65_000,
          unit: "para",
          billing: "monthly",
          prepaid: {
            months: 3,
            amountCents: 65_000,
            label: "3 miesiące — promocja",
          },
        },
      ],
    },
  ],
};

export function isPromoSection(section: PricingSection): boolean {
  return section.title.startsWith("Promocja");
}

export type LocatedPriceItem = PriceItem & {
  locationId: LocationId;
  section: string;
};

export function priceItemsForLocation(locationId: LocationId): LocatedPriceItem[] {
  return pricing[locationId].flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      locationId,
      section: section.title,
    })),
  );
}

export function findPriceItem(id: string): LocatedPriceItem | null {
  for (const locationId of ["mikolow", "lubliniec"] as const) {
    const found = priceItemsForLocation(locationId).find((item) => item.id === id);
    if (found) {
      return found;
    }
  }
  return null;
}

/** monthly i pass4 idą na otwarte zapisy. one-off zostaje przy ręcznym rozliczeniu. */
export function enrollmentBillingMode(
  item: PriceItem,
): "monthly" | "pass4" | null {
  if (item.billing === "monthly" || item.billing === "pass4") {
    return item.billing;
  }
  return null;
}

export function priceAmountCents(id: string): number | null {
  return findPriceItem(id)?.amountCents ?? null;
}
