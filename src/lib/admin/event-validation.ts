import { z } from "zod";

export const eventFormSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2, "Podaj tytuł.").max(160),
  description: z.string().trim().max(4000).optional(),
  locationId: z.enum(["mikolow", "lubliniec", ""]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę."),
  startTime: z.string().min(4, "Podaj godzinę startu."),
  endTime: z.string().min(4, "Podaj godzinę końca."),
  capacity: z.union([z.literal(""), z.coerce.number().int().min(1).max(500)]),
  signupOpen: z.boolean(),
  published: z.boolean(),
});
