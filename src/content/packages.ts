import { pricing } from "@/content/pricing";
import type { PackageKind } from "@/lib/types";

export type WeddingPackageKind = Extract<
  PackageKind,
  "wedding_single" | "wedding_6" | "wedding_10"
>;

export type WeddingPackageDef = {
  kind: WeddingPackageKind;
  label: string;
  totalLessons: number;
  priceCents: number;
  featured: boolean;
  summary: string;
};

function individualPriceCents(itemId: string): number {
  const section = pricing.mikolow.find(
    (entry) => entry.title === "Lekcje indywidualne",
  );
  const item = section?.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error(`Brak ceny lekcji indywidualnych: ${itemId}`);
  }
  return item.amountCents;
}

export const WEDDING_PACKAGES: readonly WeddingPackageDef[] = [
  {
    kind: "wedding_single",
    label: "Pojedyncza lekcja",
    totalLessons: 1,
    priceCents: individualPriceCents("mikolow-ind-1h"),
    featured: false,
    summary: "Jedna godzina — na start albo na dopieszczenie choreografii.",
  },
  {
    kind: "wedding_6",
    label: "Pakiet 6 lekcji",
    totalLessons: 6,
    priceCents: individualPriceCents("mikolow-ind-6h"),
    featured: true,
    summary: "Najczęściej wybierany zestaw na spokojne przygotowanie choreografii.",
  },
  {
    kind: "wedding_10",
    label: "Pakiet 10 lekcji",
    totalLessons: 10,
    priceCents: individualPriceCents("mikolow-ind-10h"),
    featured: false,
    summary: "Więcej czasu na detale, pewność na parkiecie i próbę generalną.",
  },
];

export function getWeddingPackage(
  kind: string,
): WeddingPackageDef | undefined {
  return WEDDING_PACKAGES.find((item) => item.kind === kind);
}

export function weddingPackageDbLabel(def: WeddingPackageDef): string {
  return `${def.label} — pierwszy taniec`;
}

export function isWeddingPackageKind(kind: string): kind is WeddingPackageKind {
  return WEDDING_PACKAGES.some((item) => item.kind === kind);
}
