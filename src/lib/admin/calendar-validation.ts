import { z } from "zod";

export const addSlotsSchema = z.object({
  locationId: z.enum(["mikolow", "lubliniec"]),
  startsAt: z.string().min(1, "Podaj datę i godzinę."),
  durationMin: z.coerce.number().int().min(15).max(180),
  weeks: z.coerce.number().int().min(1).max(12),
});

export const classSettingsSchema = z.object({
  classId: z.uuid(),
  signupOpen: z.boolean(),
  capacity: z.coerce.number().int().min(1).max(80),
});

export const bookingIdSchema = z.object({
  bookingId: z.uuid(),
});

export const slotIdSchema = z.object({
  slotId: z.uuid(),
});
