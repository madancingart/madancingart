import { isoDateDiffDays } from "@/lib/datetime";

export type ReminderStageInput = {
  amountCents: number;
  dueDate: string;
  reminderStage: number;
};

/**
 * Kolejny etap przypomnienia albo null, gdy dziś nic nie wysyłamy.
 * Etap 1 ustawia wystawienie należności. Tu tylko 2, 3 i 4, i tylko gdy
 * nowy etap jest wyższy niż już wysłany — pominiętego etapu nie nadrabiamy.
 */
export function reminderStageFor(
  charge: ReminderStageInput,
  today: string,
): 2 | 3 | 4 | null {
  if (charge.amountCents <= 0 || charge.reminderStage >= 4) {
    return null;
  }
  const daysAfterDue = isoDateDiffDays(charge.dueDate, today);
  const stage: 2 | 3 | 4 | null =
    daysAfterDue >= 10 ? 4 : daysAfterDue >= 3 ? 3 : daysAfterDue >= -2 ? 2 : null;
  if (stage === null || stage <= charge.reminderStage) {
    return null;
  }
  return stage;
}
