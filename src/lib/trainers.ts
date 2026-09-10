export const TRAINER_ORDER = ["ola", "mikolaj", "dagmara"] as const;

export type KnownTrainerId = (typeof TRAINER_ORDER)[number];

export type TrainerCatalogEntry = {
  id: KnownTrainerId;
  name: string;
  shortName: string;
  accent: string;
};

export const TRAINER_CATALOG: readonly TrainerCatalogEntry[] = [
  {
    id: "ola",
    name: "Aleksandra Janosz",
    shortName: "Ola",
    accent: "#C9962E",
  },
  {
    id: "mikolaj",
    name: "Mikołaj Mazur",
    shortName: "Mikołaj",
    accent: "#9A7B4F",
  },
  {
    id: "dagmara",
    name: "Dagmara Janosz",
    shortName: "Dagmara",
    accent: "#C9B287",
  },
] as const;

export const UNASSIGNED_TRAINER_LABEL = "— nieprzypisany";

export function sortTrainers<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftIndex = TRAINER_ORDER.indexOf(left.id as KnownTrainerId);
    const rightIndex = TRAINER_ORDER.indexOf(right.id as KnownTrainerId);
    const leftRank = leftIndex === -1 ? TRAINER_ORDER.length : leftIndex;
    const rightRank = rightIndex === -1 ? TRAINER_ORDER.length : rightIndex;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.id.localeCompare(right.id);
  });
}

export function trainerShortName(id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }
  const known = TRAINER_CATALOG.find((item) => item.id === id);
  if (known) {
    return known.shortName;
  }
  return id;
}

export function trainerAccent(id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }
  return TRAINER_CATALOG.find((item) => item.id === id)?.accent ?? null;
}

export function trainerFilterLabel(id: string, fallbackName: string): string {
  return TRAINER_CATALOG.find((item) => item.id === id)?.shortName ?? fallbackName;
}
