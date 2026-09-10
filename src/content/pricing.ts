import type { LocationId } from "@/content/site";

export type PriceUnit = "os/mies" | "para/mies" | "os" | "para" | "h" | "pakiet";

export type PriceItem = {
  id: string;
  label: string;
  detail?: string;
  amountCents: number;
  unit: PriceUnit;
  note?: string;
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
        },
        {
          id: "mikolow-uzytkowy-75",
          label: "Zajęcia miesięczne",
          detail: "1 h 15 min",
          amountCents: 36_000,
          unit: "para/mies",
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
        },
        {
          id: "mikolow-ind-6h",
          label: "Pakiet 6 h",
          amountCents: 80_000,
          unit: "pakiet",
        },
        {
          id: "mikolow-ind-10h",
          label: "Pakiet 10 h",
          amountCents: 120_000,
          unit: "pakiet",
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
        },
        {
          id: "lubliniec-latino-4x-75",
          label: "4 wejścia",
          detail: "1 h 15 min",
          amountCents: 18_000,
          unit: "os",
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
        },
        {
          id: "lubliniec-uzytkowy-4x-75",
          label: "4 wejścia",
          detail: "1 h 15 min",
          amountCents: 36_000,
          unit: "para",
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
        },
        {
          id: "lubliniec-ind-6h",
          label: "Pakiet 6 h",
          amountCents: 80_000,
          unit: "pakiet",
        },
        {
          id: "lubliniec-ind-10h",
          label: "Pakiet 10 h",
          amountCents: 120_000,
          unit: "pakiet",
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
        },
        {
          id: "lubliniec-promo-75-8",
          label: "8 wejść",
          detail: "1 h 15 min",
          amountCents: 72_000,
          unit: "para",
        },
        {
          id: "lubliniec-promo-75-3m-1x",
          label: "3 miesiące, 1×/tydz.",
          detail: "1 h 15 min",
          amountCents: 95_000,
          unit: "para",
        },
        {
          id: "lubliniec-promo-75-3m-2x",
          label: "3 miesiące, 2×/tydz.",
          detail: "1 h 15 min",
          amountCents: 190_000,
          unit: "para",
        },
        {
          id: "lubliniec-promo-60-4",
          label: "4 wejścia",
          detail: "1 h",
          amountCents: 24_000,
          unit: "para",
        },
        {
          id: "lubliniec-promo-60-3m",
          label: "3 miesiące",
          detail: "1 h",
          amountCents: 65_000,
          unit: "para",
        },
      ],
    },
  ],
};

export function isPromoSection(section: PricingSection): boolean {
  return section.title.startsWith("Promocja");
}

export function priceAmountCents(id: string): number | null {
  for (const sections of Object.values(pricing)) {
    for (const section of sections) {
      const item = section.items.find((row) => row.id === id);
      if (item) {
        return item.amountCents;
      }
    }
  }
  return null;
}
