import { z } from "zod";
import type { BookingKind, PaymentOption } from "@/lib/types";

export const DANCE_TYPES = [
  "Pierwszy taniec weselny",
  "Taniec użytkowy",
  "Latino solo",
  "Lekcja techniki",
  "Inne",
] as const;

export type DanceType = (typeof DANCE_TYPES)[number];

export function isPaymentsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9) {
    return `+48${digits}`;
  }
  if (digits.startsWith("48")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Podaj numer telefonu.")
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 9 && digits.length <= 15;
    },
    { error: "Podaj numer telefonu (9–15 cyfr, możesz wpisać +48)." },
  )
  .transform(normalizePhone);

export const bookingFormSchema = z.object({
  firstName: z.string().trim().min(2, "Imię musi mieć co najmniej 2 znaki."),
  lastName: z.string().trim().min(2, "Nazwisko musi mieć co najmniej 2 znaki."),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: "Podaj poprawny adres e-mail." }))
    .transform((value) => value.toLowerCase()),
  message: z
    .string()
    .max(500, "Wiadomość może mieć maksymalnie 500 znaków.")
    .default("")
    .transform((value) => value.trim()),
  danceType: z.string().optional(),
  paymentOption: z.enum(["onsite", "reservation", "full"]),
  consentRodo: z.boolean().refine((value) => value === true, {
    error:
      "Zgoda na przetwarzanie danych jest wymagana.",
  }),
  website: z.string().optional(),
});

export type BookingFormInput = z.input<typeof bookingFormSchema>;
export type BookingFormValues = z.output<typeof bookingFormSchema>;

export const bookingApiSchema = bookingFormSchema
  .extend({
    kind: z.enum(["slot", "class", "event"]),
    targetId: z.uuid({ error: "Nieprawidłowy identyfikator terminu." }),
    locationId: z.enum(["mikolow", "lubliniec"]),
    title: z.string().trim().min(1).max(200),
    startsAt: z.string().min(1, "Brak godziny rozpoczęcia."),
    endsAt: z.string().min(1, "Brak godziny zakończenia."),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== "slot") {
      return;
    }
    if (!DANCE_TYPES.includes(data.danceType as DanceType)) {
      ctx.addIssue({
        code: "custom",
        path: ["danceType"],
        message: "Wybierz, czego dotyczą zajęcia.",
      });
    }
  });

export type BookingApiInput = z.infer<typeof bookingApiSchema>;

export function coercePaymentOption(
  option: PaymentOption,
): PaymentOption {
  if (!isPaymentsEnabled()) {
    return "onsite";
  }
  return option;
}
