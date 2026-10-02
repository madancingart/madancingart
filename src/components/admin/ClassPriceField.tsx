"use client";

import {
  priceItemsForLocation,
  type LocatedPriceItem,
} from "@/content/pricing";
import type { LocationId } from "@/content/site";
import { formatPlnFromCents } from "@/lib/money";

function isLocationId(value: string): value is LocationId {
  return value === "mikolow" || value === "lubliniec";
}

function choiceLabel(item: LocatedPriceItem): string {
  const detail = item.detail ? ` ${item.detail}` : "";
  const price = formatPlnFromCents(item.amountCents);
  if (item.prepaid) {
    return `${item.section}: ${item.label}${detail} — ${item.prepaid.label}`;
  }
  if (item.billing === "pass4") {
    return `${item.section}: ${item.label}${detail} — karnet, ${price}`;
  }
  if (item.billing === "one-off") {
    return `${item.section}: ${item.label}${detail} — ręcznie, ${price}`;
  }
  return `${item.section}: ${item.label}${detail} — ${price}`;
}

export function ClassPriceField({
  locationId,
  value,
  disabled,
  onChange,
}: {
  locationId: string;
  value: string | null;
  disabled?: boolean;
  onChange: (priceItemId: string) => void;
}) {
  const items = isLocationId(locationId) ? priceItemsForLocation(locationId) : [];
  const current = value ?? "";

  return (
    <label className="text-[13px] text-muted">
      Pozycja cennika
      <select
        value={current}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
      >
        <option value="">Brak — bot nie rozlicza</option>
        {current && !items.some((item) => item.id === current) ? (
          <option value={current}>Nieznana pozycja</option>
        ) : null}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {choiceLabel(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
