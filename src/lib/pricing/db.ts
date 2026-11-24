import "server-only";

import { cache } from "react";
import {
  type LocatedPriceItem,
  type PriceBilling,
  type PriceItem,
  type PriceUnit,
  type PricingSection,
  pricing as staticPricing,
} from "@/content/pricing";
import type { LocationId } from "@/content/site";
import { createAdminClient } from "@/lib/supabase/admin";

type PriceItemRow = {
  id: string;
  location_id: string;
  section: string;
  label: string;
  detail: string | null;
  amount_cents: number;
  unit: PriceUnit;
  note: string | null;
  billing: PriceBilling;
  sort_order: number;
  active: boolean;
  prepaid_months: number | null;
  prepaid_amount_cents: number | null;
  prepaid_label: string | null;
};

function rowToItem(row: PriceItemRow): LocatedPriceItem {
  const prepaid =
    row.prepaid_months === 3 &&
    row.prepaid_amount_cents != null &&
    row.prepaid_label
      ? {
          months: 3 as const,
          amountCents: row.prepaid_amount_cents,
          label: row.prepaid_label,
        }
      : undefined;
  return {
    id: row.id,
    label: row.label,
    detail: row.detail ?? undefined,
    amountCents: row.amount_cents,
    unit: row.unit,
    note: row.note ?? undefined,
    billing: row.billing,
    prepaid,
    locationId: row.location_id as LocationId,
    section: row.section,
  };
}

export const loadActivePriceItems = cache(async (): Promise<LocatedPriceItem[]> => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("price_items")
      .select(
        "id,location_id,section,label,detail,amount_cents,unit,note,billing,sort_order,active,prepaid_months,prepaid_amount_cents,prepaid_label",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error || !data?.length) {
      return fallbackItems();
    }
    return (data as PriceItemRow[]).map(rowToItem);
  } catch {
    return fallbackItems();
  }
});

export const loadAllPriceItemsAdmin = cache(async (): Promise<LocatedPriceItem[]> => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("price_items")
    .select(
      "id,location_id,section,label,detail,amount_cents,unit,note,billing,sort_order,active,prepaid_months,prepaid_amount_cents,prepaid_label",
    )
    .order("location_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error || !data) {
    return fallbackItems();
  }
  return (data as PriceItemRow[]).map(rowToItem);
});

function fallbackItems(): LocatedPriceItem[] {
  const out: LocatedPriceItem[] = [];
  for (const locationId of ["mikolow", "lubliniec"] as const) {
    for (const section of staticPricing[locationId]) {
      for (const item of section.items) {
        out.push({ ...item, locationId, section: section.title });
      }
    }
  }
  return out;
}

export async function resolvePriceItem(id: string): Promise<LocatedPriceItem | null> {
  const items = await loadActivePriceItems();
  return items.find((item) => item.id === id) ?? null;
}

export async function priceItemsForLocationDb(
  locationId: LocationId,
): Promise<LocatedPriceItem[]> {
  const items = await loadActivePriceItems();
  return items.filter((item) => item.locationId === locationId);
}

export async function pricingSectionsForLocation(
  locationId: LocationId,
): Promise<PricingSection[]> {
  const items = await priceItemsForLocationDb(locationId);
  const bySection = new Map<string, PriceItem[]>();
  for (const item of items) {
    const list = bySection.get(item.section) ?? [];
    list.push({
      id: item.id,
      label: item.label,
      detail: item.detail,
      amountCents: item.amountCents,
      unit: item.unit,
      note: item.note,
      billing: item.billing,
      prepaid: item.prepaid,
    });
    bySection.set(item.section, list);
  }
  return [...bySection.entries()].map(([title, sectionItems]) => ({
    title,
    items: sectionItems,
  }));
}

export type PriceItemInput = {
  id?: string;
  locationId: LocationId;
  section: string;
  label: string;
  detail?: string | null;
  amountCents: number;
  unit: PriceUnit;
  note?: string | null;
  billing: PriceBilling;
  sortOrder?: number;
  active?: boolean;
  prepaid?: { months: 3; amountCents: number; label: string } | null;
};

export function slugifyPriceId(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}
