import { z } from "zod";

const trainerIdValue = z
  .string()
  .trim()
  .max(64)
  .transform((value) => (value.length === 0 ? null : value));

export const addSlotsSchema = z.object({
  locationId: z.enum(["mikolow", "lubliniec"]),
  startsAt: z.string().min(1, "Podaj datę i godzinę."),
  durationMin: z.coerce.number().int().min(15).max(180),
  weeks: z.coerce.number().int().min(1).max(12),
  trainerId: z.string().trim().min(1, "Wybierz prowadzącego.").max(64),
});

export const classSettingsSchema = z.object({
  classId: z.uuid(),
  signupOpen: z.boolean(),
  capacity: z.coerce.number().int().min(1).max(80),
  trainerId: trainerIdValue,
  priceItemId: z
    .string()
    .trim()
    .max(80)
    .transform((value) => (value.length === 0 ? null : value)),
});

export const slotTrainerSchema = z.object({
  slotId: z.uuid(),
  trainerId: trainerIdValue,
});

export const bookingIdSchema = z.object({
  bookingId: z.uuid(),
});

export const cancelBookingSchema = z.object({
  bookingId: z.uuid(),
  notifyClient: z.boolean().optional(),
});

export const moveBookingSchema = z.object({
  bookingId: z.uuid(),
  newSlotId: z.uuid(),
});

export const slotIdSchema = z.object({
  slotId: z.uuid(),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę.");
const clockHm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Podaj godzinę.");

export const slotSeriesOccupancySchema = z.object({
  locationId: z.enum(["mikolow", "lubliniec"]),
  trainerId: z.string().trim().max(64).optional(),
  fromDate: isoDate,
  toDate: isoDate,
});

export const createSlotSeriesSchema = z
  .object({
    locationId: z.enum(["mikolow", "lubliniec"]),
    trainerId: z.string().trim().min(1, "Wybierz prowadzącego.").max(64),
    fromDate: isoDate,
    toDate: isoDate,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Wybierz dni."),
    windows: z
      .array(z.object({ start: clockHm, end: clockHm }))
      .min(1, "Dodaj okno czasowe."),
    durationMin: z.coerce.number().int().min(15).max(180),
    breakMin: z.union([
      z.literal(0),
      z.literal(5),
      z.literal(10),
      z.literal(15),
    ]),
    selected: z
      .array(z.object({ date: isoDate, start: clockHm }))
      .min(1, "Zaznacz terminy.")
      .max(800),
  })
  .superRefine((value, ctx) => {
    if (value.fromDate > value.toDate) {
      ctx.addIssue({
        code: "custom",
        message: "Data końcowa jest wcześniejsza niż początkowa.",
        path: ["toDate"],
      });
    }
    const [year, month, day] = value.fromDate.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const limit = new Date(Date.UTC(year, month - 1 + 3, day))
      .toISOString()
      .slice(0, 10);
    if (value.toDate > limit) {
      ctx.addIssue({
        code: "custom",
        message: "Zakres może mieć maksymalnie 3 miesiące.",
        path: ["toDate"],
      });
    }
    for (const [index, window] of value.windows.entries()) {
      if (window.start >= window.end) {
        ctx.addIssue({
          code: "custom",
          message: "Godzina końca musi być później niż początek.",
          path: ["windows", index, "end"],
        });
      }
    }
  });
