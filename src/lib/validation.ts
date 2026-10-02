import { z } from "zod";
import { warsawTodayIso } from "@/lib/datetime";
import type { BookingKind, CustomerKind } from "@/lib/types";

export const DANCE_TYPES = [
  "Pierwszy taniec weselny",
  "Taniec użytkowy",
  "Latino solo",
  "Lekcja techniki",
  "Inne",
] as const;

export type DanceType = (typeof DANCE_TYPES)[number];

export const PAIR_DANCE_TYPES: readonly DanceType[] = [
  "Pierwszy taniec weselny",
  "Taniec użytkowy",
];

export const CHILD_CLASS_SLUGS = ["dzieci-4-7", "dzieci-8-14"] as const;

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

export function isPairDanceType(value: string | null | undefined): boolean {
  return PAIR_DANCE_TYPES.includes(value as DanceType);
}

export function isChildClassSlug(value: string | null | undefined): boolean {
  return CHILD_CLASS_SLUGS.includes(
    value as (typeof CHILD_CLASS_SLUGS)[number],
  );
}

export function customerKindFromClass(input: {
  slug: string | null | undefined;
  isPair: boolean;
}): CustomerKind {
  if (isChildClassSlug(input.slug)) {
    return "child";
  }
  if (input.isPair) {
    return "pair";
  }
  return "adult";
}

export function customerKindForSlot(
  danceType: string | null | undefined,
): CustomerKind {
  return isPairDanceType(danceType) ? "pair" : "adult";
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

function nameSchema(message: string) {
  return z.string().trim().min(2, message);
}

const bookingSharedFields = {
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
  paymentOption: z
    .enum(["onsite", "reservation", "full"])
    .default("full")
    .transform((): "full" => "full"),
  consentRodo: z.boolean().refine((value) => value === true, {
    error: "Zgoda na przetwarzanie danych jest wymagana.",
  }),
  website: z.string().optional(),
};

const adultBookingSchema = z.object({
  customerKind: z.literal("adult"),
  firstName: nameSchema("Imię musi mieć co najmniej 2 znaki."),
  lastName: nameSchema("Nazwisko musi mieć co najmniej 2 znaki."),
  ...bookingSharedFields,
});

const pairBookingSchema = z.object({
  customerKind: z.literal("pair"),
  firstName: nameSchema("Imię pierwszej osoby musi mieć co najmniej 2 znaki."),
  lastName: nameSchema(
    "Nazwisko pierwszej osoby musi mieć co najmniej 2 znaki.",
  ),
  partnerFirstName: nameSchema(
    "Imię drugiej osoby musi mieć co najmniej 2 znaki.",
  ),
  partnerLastName: nameSchema(
    "Nazwisko drugiej osoby musi mieć co najmniej 2 znaki.",
  ),
  ...bookingSharedFields,
});

const childBookingSchema = z.object({
  customerKind: z.literal("child"),
  firstName: nameSchema("Imię dziecka musi mieć co najmniej 2 znaki."),
  lastName: nameSchema("Nazwisko dziecka musi mieć co najmniej 2 znaki."),
  guardianFirstName: nameSchema(
    "Imię rodzica/opiekuna musi mieć co najmniej 2 znaki.",
  ),
  guardianLastName: nameSchema(
    "Nazwisko rodzica/opiekuna musi mieć co najmniej 2 znaki.",
  ),
  ...bookingSharedFields,
});

export const bookingFormSchema = z.discriminatedUnion("customerKind", [
  adultBookingSchema,
  pairBookingSchema,
  childBookingSchema,
]);

export type BookingFormInput = z.input<typeof bookingFormSchema>;
export type BookingFormValues = z.output<typeof bookingFormSchema>;

const bookingRequestMeta = z.object({
  kind: z.enum(["slot", "class", "event"]),
  targetId: z.uuid({ error: "Nieprawidłowy identyfikator terminu." }),
  locationId: z.enum(["mikolow", "lubliniec"]),
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().min(1, "Brak godziny rozpoczęcia."),
  endsAt: z.string().min(1, "Brak godziny zakończenia."),
});

export const bookingApiSchema = z
  .intersection(bookingFormSchema, bookingRequestMeta)
  .superRefine((data, ctx) => {
    if (data.kind === "slot") {
      if (!DANCE_TYPES.includes(data.danceType as DanceType)) {
        ctx.addIssue({
          code: "custom",
          path: ["danceType"],
          message: "Wybierz, czego dotyczą zajęcia.",
        });
      }
      const expected = customerKindForSlot(data.danceType);
      if (data.customerKind !== expected) {
        ctx.addIssue({
          code: "custom",
          path: ["customerKind"],
          message: "Sprawdź dane osób zapisanych na ten typ zajęć.",
        });
      }
    }
    if (data.kind === "event" && data.customerKind !== "adult") {
      ctx.addIssue({
        code: "custom",
        path: ["customerKind"],
        message: "Sprawdź dane osób zapisanych na ten typ zajęć.",
      });
    }
  });

export type BookingApiInput = z.infer<typeof bookingApiSchema>;

export function coercePaymentOption(): "full" {
  return "full";
}

export function formCustomerKindForTarget(input: {
  bookingKind: BookingKind;
  classSlug?: string | null;
  isPair?: boolean;
}): CustomerKind {
  if (input.bookingKind === "class") {
    return customerKindFromClass({
      slug: input.classSlug,
      isPair: Boolean(input.isPair),
    });
  }
  return "adult";
}

export function guardianDisplayName(
  firstName: string,
  lastName: string,
): string {
  return `${firstName} ${lastName}`.trim();
}

const isoDateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę wesela.");

export const WEDDING_PACKAGE_KINDS = [
  "wedding_single",
  "wedding_6",
  "wedding_10",
] as const;

export function isFutureWarsawDate(
  isoDate: string,
  todayIso: string,
): boolean {
  return isoDate > todayIso;
}

export const packageSongSchema = z.object({
  title: nameSchema("Podaj tytuł utworu."),
  artist: nameSchema("Podaj wykonawcę."),
});

export const packagePurchaseSchema = z
  .object({
    packageKind: z.enum(WEDDING_PACKAGE_KINDS, {
      error: "Wybierz pakiet.",
    }),
    firstName: nameSchema("Imię pierwszej osoby musi mieć co najmniej 2 znaki."),
    lastName: nameSchema(
      "Nazwisko pierwszej osoby musi mieć co najmniej 2 znaki.",
    ),
    partnerFirstName: nameSchema(
      "Imię drugiej osoby musi mieć co najmniej 2 znaki.",
    ),
    partnerLastName: nameSchema(
      "Nazwisko drugiej osoby musi mieć co najmniej 2 znaki.",
    ),
    phone: phoneSchema,
    email: z
      .string()
      .trim()
      .pipe(z.email({ error: "Podaj poprawny adres e-mail." }))
      .transform((value) => value.toLowerCase()),
    weddingDate: isoDateOnly,
    songs: z
      .array(packageSongSchema)
      .min(1, "Dodaj przynajmniej jedną propozycję piosenki.")
      .max(5, "Możesz podać maksymalnie 5 utworów."),
    consentRodo: z.boolean().refine((value) => value === true, {
      error: "Zgoda na przetwarzanie danych jest wymagana.",
    }),
    website: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!isFutureWarsawDate(data.weddingDate, warsawTodayIso())) {
      ctx.addIssue({
        code: "custom",
        path: ["weddingDate"],
        message: "Data wesela musi być w przyszłości.",
      });
    }
  });

export type PackagePurchaseInput = z.input<typeof packagePurchaseSchema>;
export type PackagePurchaseValues = z.output<typeof packagePurchaseSchema>;

export function songsToStored(songs: { title: string; artist: string }[]): string[] {
  return songs.map((song) => `${song.title} — ${song.artist}`);
}

export const CONTACT_TOPICS = [
  "Pierwszy taniec",
  "Zajęcia grupowe",
  "Lekcje indywidualne",
  "Pokazy",
  "Kursy",
  "Inne",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

function contactPhoneOk(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export const contactFormSchema = z
  .object({
    name: z.string().trim().min(2, "Podaj imię (co najmniej 2 znaki)."),
    phone: z.string().trim().default(""),
    email: z.string().trim().default(""),
    topic: z.enum(CONTACT_TOPICS, { error: "Wybierz temat." }),
    message: z
      .string()
      .trim()
      .min(1, "Napisz wiadomość.")
      .max(1000, "Wiadomość może mieć maksymalnie 1000 znaków."),
    consentRodo: z.boolean().refine((value) => value === true, {
      error: "Zgoda na przetwarzanie danych jest wymagana.",
    }),
    website: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasPhone = data.phone.length > 0;
    const hasEmail = data.email.length > 0;

    if (!hasPhone && !hasEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Podaj telefon albo e-mail.",
      });
      return;
    }

    if (hasPhone && !contactPhoneOk(data.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Podaj numer telefonu (9–15 cyfr, możesz wpisać +48).",
      });
    }

    if (hasEmail && !z.email().safeParse(data.email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Podaj poprawny adres e-mail.",
      });
    }
  });

export type ContactFormInput = z.input<typeof contactFormSchema>;
export type ContactFormValues = z.output<typeof contactFormSchema>;
