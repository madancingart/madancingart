import type { LocationId } from "@/content/site";
import { weekdayLongLabel } from "@/lib/datetime";

/** ISO weekday (1 = poniedziałek) z seedu grafiku. */
export const classWeekdays: Record<LocationId, readonly number[]> = {
  mikolow: [1, 4],
  lubliniec: [2, 5],
};

export function formatWeekdays(weekdays: readonly number[]): string {
  const labels = weekdays
    .map((weekday) => weekdayLongLabel(weekday))
    .filter((label) => label.length > 0);

  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  const head = labels.slice(0, -1).join(", ");
  const tail = labels[labels.length - 1];
  return `${head} i ${tail}`;
}
