import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { customerDisplayName } from "@/lib/admin/customer-label";
import { buildAgenda, addIsoDays, type AgendaItem } from "@/lib/account/agenda";
import { payChargeHref } from "@/lib/account/redirect";
import {
  arrearsLine,
  billingStatus,
  monthNominative,
  pickPayableCharge,
  type BillingCharge,
  type BillingPass,
} from "@/lib/billing/status";
import { site } from "@/content/site";
import { TZDate } from "@date-fns/tz";
import { WARSAW_TZ, warsawTodayIso, weekdayLongLabel } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  EnrollmentBillingMode,
  EnrollmentStatus,
  MyParticipantRow,
} from "@/lib/types";

export type AccountProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  interests: string[];
};

export type AccountContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  profile: AccountProfile;
};

export type ArrearBanner = {
  id: string;
  text: string;
  payHref: string;
};

export type EnrollmentCardModel = {
  id: string;
  title: string;
  place: string;
  when: string;
  trainer: string | null;
  participant: string | null;
  paused: boolean;
  tone: "red" | "amber" | "pending" | "green";
  label: string;
  payHref: string | null;
};

export type ChargeListItem = {
  id: string;
  period: string;
  description: string;
  amountCents: number;
  dueDate: string;
  state: string;
  method: string;
  payHref: string | null;
};

export type ClassPanel = {
  arrears: ArrearBanner[];
  cards: EnrollmentCardModel[];
  agenda: AgendaItem[];
  cancellationsNote: string | null;
  lessonsNote: string | null;
};

type EnrollmentDb = {
  id: string;
  customer_id: string;
  recurring_class_id: string;
  status: EnrollmentStatus;
  billing_mode: EnrollmentBillingMode;
  started_on: string;
  paid_until: string | null;
  hold_expires_at: string | null;
};

type ChargeDb = {
  id: string;
  customer_id: string;
  enrollment_id: string | null;
  kind: string;
  label: string;
  period_start: string | null;
  period_end: string | null;
  amount_cents: number;
  due_date: string;
  status: "open" | "paid" | "void";
  payment_method: "stripe" | "onsite" | "transfer" | "legacy" | null;
  note: string | null;
};

type ClassDb = {
  id: string;
  location_id: string;
  class_type_id: string;
  weekday: number;
  start_time: string;
  trainer_id: string | null;
};

type PackageDb = {
  id: string;
  customer_id: string;
  recurring_class_id: string | null;
  kind: string;
  status: string;
  total_lessons: number | null;
  valid_until: string | null;
};

type BookingDb = {
  id: string;
  kind: string;
  status: string;
  slot_id: string | null;
  event_id: string | null;
  series_id: string | null;
  dance_type: string | null;
  customer_id: string | null;
};

type EventDb = {
  id: string;
  title: string;
  location_id: string | null;
  starts_at: string;
  series_id: string | null;
  session_no: number | null;
};

const OPEN_ENROLLMENT = ["pending", "active", "paused"] as const;

const CHARGE_COLUMNS =
  "id, customer_id, enrollment_id, kind, label, period_start, period_end, amount_cents, due_date, status, payment_method, note";

function list<T>(value: T[] | null): T[] {
  return value ?? [];
}

function dateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function warsawInstant(isoDate: string): string {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = isoDate.split("-");
  return new TZDate(
    Number.parseInt(yearPart, 10),
    Number.parseInt(monthPart, 10) - 1,
    Number.parseInt(dayPart, 10),
    0,
    0,
    WARSAW_TZ,
  ).toISOString();
}

function placeName(
  locationId: string | null,
  locations: Map<string, string>,
): string {
  if (!locationId) {
    return "Sala";
  }
  const known = site.locations.find((location) => location.id === locationId);
  return known?.city ?? locations.get(locationId) ?? "Sala";
}

function participantLine(person: MyParticipantRow | undefined): string | null {
  if (!person || person.kind === "adult") {
    return null;
  }
  return customerDisplayName({
    kind: person.kind,
    firstName: person.first_name,
    lastName: person.last_name,
    partnerFirstName: person.partner_first_name,
    partnerLastName: person.partner_last_name,
  });
}

function toBillingCharge(row: ChargeDb): BillingCharge {
  return {
    status: row.status,
    dueDate: dateOnly(row.due_date) ?? row.due_date,
    amountCents: row.amount_cents,
    periodStart: dateOnly(row.period_start),
    periodEnd: dateOnly(row.period_end),
  };
}

function selectPass(
  packages: readonly PackageDb[],
  used: ReadonlyMap<string, number>,
  customerId: string,
  classId: string,
  today: string,
): BillingPass | null {
  const matches = packages.filter(
    (row) =>
      row.customer_id === customerId &&
      row.recurring_class_id === classId &&
      row.status === "active" &&
      (row.kind === "pass_4" || row.kind === "pass_8"),
  );
  if (matches.length === 0) {
    return null;
  }

  const mapped = matches.map((row) => {
    const total = row.total_lessons ?? (row.kind === "pass_8" ? 8 : 4);
    return {
      remaining: total - (used.get(row.id) ?? 0),
      total,
      validUntil: dateOnly(row.valid_until),
    };
  });
  const covering = mapped.filter(
    (row) => row.remaining > 0 && (!row.validUntil || row.validUntil >= today),
  );
  const pool = covering.length > 0 ? covering : mapped;
  pool.sort((left, right) =>
    (right.validUntil ?? "").localeCompare(left.validUntil ?? ""),
  );
  return pool[0] ?? null;
}

function periodLabel(start: string | null, end: string | null): string {
  const from = dateOnly(start);
  const until = dateOnly(end);
  if (from && until) {
    const [year = ""] = until.split("-").slice(0, 1);
    const fromDay = Number.parseInt(from.slice(8, 10), 10);
    const fromMonth = Number.parseInt(from.slice(5, 7), 10);
    const untilDay = Number.parseInt(until.slice(8, 10), 10);
    const untilMonth = Number.parseInt(until.slice(5, 7), 10);
    return `${fromDay}.${fromMonth}–${untilDay}.${untilMonth}.${year}`;
  }
  if (from) {
    const day = Number.parseInt(from.slice(8, 10), 10);
    const month = Number.parseInt(from.slice(5, 7), 10);
    return `${day}.${month}.${from.slice(0, 4)}`;
  }
  return "—";
}

function chargeState(row: ChargeDb, today: string): string {
  if (row.status === "paid") {
    return "Opłacone";
  }
  if (row.status === "void") {
    return "Anulowane";
  }
  return dateOnly(row.due_date) !== null && (dateOnly(row.due_date) ?? "") < today
    ? "Zaległość"
    : "Do zapłaty";
}

function methodLabel(method: ChargeDb["payment_method"]): string {
  if (method === "stripe") {
    return "Online";
  }
  if (method === "onsite") {
    return "Gotówka";
  }
  if (method === "transfer") {
    return "Przelew";
  }
  if (method === "legacy") {
    return "Wcześniejsza wpłata";
  }
  return "—";
}

export function toChargeListItem(row: ChargeDb, today: string): ChargeListItem {
  const due = dateOnly(row.due_date) ?? row.due_date;
  const payable = row.status === "open";
  return {
    id: row.id,
    period: periodLabel(row.period_start, row.period_end),
    description: row.note ? `${row.label} — ${row.note}` : row.label,
    amountCents: row.amount_cents,
    dueDate: due,
    state: chargeState(row, today),
    method: methodLabel(row.payment_method),
    payHref: payable ? payChargeHref(row.id) : null,
  };
}

export const requireAccount = cache(async (): Promise<AccountContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/konto/logowanie?next=/konto");
  }

  const { data } = await supabase
    .from("account_profiles")
    .select("first_name, last_name, phone, interests")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    redirect("/konto/uzupelnij?next=/konto");
  }

  const profileRow = data as {
    first_name: string;
    last_name: string;
    phone: string;
    interests: string[] | null;
  };

  return {
    supabase,
    user,
    profile: {
      firstName: profileRow.first_name,
      lastName: profileRow.last_name,
      phone: profileRow.phone,
      interests: profileRow.interests ?? [],
    },
  };
});

export const loadClassPanel = cache(async (): Promise<ClassPanel | null> => {
  const { supabase } = await requireAccount();
  const today = warsawTodayIso();
  const until = addIsoDays(today, 14);
  const windowStart = warsawInstant(today);
  const windowEnd = warsawInstant(until);

  const [enrollmentsResult, chargesResult, participantsResult, packagesResult, attendanceResult, bookingsResult, typesResult, trainersResult, locationsResult] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select(
          "id, customer_id, recurring_class_id, status, billing_mode, started_on, paid_until, hold_expires_at",
        )
        .in("status", [...OPEN_ENROLLMENT]),
      supabase.from("charges").select(CHARGE_COLUMNS).order("due_date", { ascending: true }),
      supabase.rpc("my_participants"),
      supabase
        .from("packages")
        .select("id, customer_id, recurring_class_id, kind, status, total_lessons, valid_until")
        .in("kind", ["pass_4", "pass_8"]),
      supabase.from("attendance").select("package_id").eq("present", true).not("package_id", "is", null),
      supabase
        .from("bookings")
        .select("id, kind, status, slot_id, event_id, series_id, dance_type, customer_id")
        .neq("status", "cancelled"),
      supabase.from("class_types").select("id, name"),
      supabase.from("trainers").select("id, name").eq("active", true),
      supabase.from("locations").select("id, name"),
    ]);

  if (enrollmentsResult.error || chargesResult.error || participantsResult.error) {
    return null;
  }

  const enrollments = list(enrollmentsResult.data as EnrollmentDb[] | null);
  const charges = list(chargesResult.data as ChargeDb[] | null);
  const participants = list(participantsResult.data as MyParticipantRow[] | null);
  const packages = packagesResult.error
    ? []
    : list(packagesResult.data as PackageDb[] | null);
  const people = new Map(participants.map((person) => [person.id, person]));
  const used = new Map<string, number>();
  if (!attendanceResult.error) {
    for (const row of list(attendanceResult.data as { package_id: string | null }[] | null)) {
      if (!row.package_id) {
        continue;
      }
      used.set(row.package_id, (used.get(row.package_id) ?? 0) + 1);
    }
  }

  const classIds = [...new Set(enrollments.map((row) => row.recurring_class_id))];
  const classesResult = classIds.length
    ? await supabase
        .from("recurring_classes")
        .select("id, location_id, class_type_id, weekday, start_time, trainer_id")
        .in("id", classIds)
    : { data: [], error: null };
  const classes = classesResult.error
    ? []
    : list(classesResult.data as ClassDb[] | null);
  const classById = new Map(classes.map((row) => [row.id, row]));

  // class_sessions są tylko dla admina — odwołania czytamy z publicznego widoku, po stronie serwera.
  let cancellationsNote: string | null = null;
  const cancelledByClass = new Map<string, string[]>();
  if (classIds.length > 0) {
    const cancelled = await supabase
      .from("public_cancelled_sessions")
      .select("recurring_class_id, session_date")
      .in("recurring_class_id", classIds)
      .gte("session_date", today)
      .lte("session_date", addIsoDays(today, 13));
    if (cancelled.error) {
      cancellationsNote = "Nie udało się sprawdzić odwołań.";
    } else {
      for (const row of list(
        cancelled.data as { recurring_class_id: string; session_date: string }[] | null,
      )) {
        const listForClass = cancelledByClass.get(row.recurring_class_id) ?? [];
        listForClass.push(row.session_date.slice(0, 10));
        cancelledByClass.set(row.recurring_class_id, listForClass);
      }
    }
  }

  const typeNames = new Map(
    list(typesResult.data as { id: string; name: string }[] | null).map((row) => [
      row.id,
      row.name,
    ]),
  );
  const trainerNames = new Map(
    list(trainersResult.data as { id: string; name: string }[] | null).map((row) => [
      row.id,
      row.name,
    ]),
  );
  const locations = new Map(
    list(locationsResult.data as { id: string; name: string }[] | null).map((row) => [
      row.id,
      row.name,
    ]),
  );

  const classNameByEnrollment = new Map<string, string>();
  const cards: EnrollmentCardModel[] = enrollments.map((enrollment) => {
    const danceClass = classById.get(enrollment.recurring_class_id);
    const title = danceClass
      ? (typeNames.get(danceClass.class_type_id) ?? "Zajęcia")
      : "Zajęcia";
    classNameByEnrollment.set(enrollment.id, title);
    const ownCharges = charges
      .filter((charge) => charge.enrollment_id === enrollment.id)
      .map(toBillingCharge);
    const status = billingStatus({
      today,
      enrollmentStatus: enrollment.status,
      billingMode: enrollment.billing_mode,
      paidUntil: dateOnly(enrollment.paid_until),
      holdExpiresAt: enrollment.hold_expires_at,
      charges: ownCharges,
      pass:
        enrollment.billing_mode === "pass4"
          ? selectPass(
              packages,
              used,
              enrollment.customer_id,
              enrollment.recurring_class_id,
              today,
            )
          : null,
    });
    const payable = pickPayableCharge(
      charges
        .filter((charge) => charge.enrollment_id === enrollment.id)
        .map((charge) => ({ ...charge, dueDate: dateOnly(charge.due_date) ?? charge.due_date })),
      today,
    );
    const showPay =
      payable !== null &&
      (status.tone === "red" || status.tone === "amber" || status.tone === "pending");

    return {
      id: enrollment.id,
      title,
      place: danceClass ? placeName(danceClass.location_id, locations) : "Sala",
      when: danceClass
        ? `${weekdayLongLabel(danceClass.weekday)}, ${danceClass.start_time.slice(0, 5)}`
        : "Termin w grafiku szkoły",
      trainer: danceClass?.trainer_id
        ? (trainerNames.get(danceClass.trainer_id) ?? null)
        : null,
      participant: participantLine(people.get(enrollment.customer_id)),
      paused: enrollment.status === "paused",
      tone: status.tone,
      label: status.label,
      payHref: showPay && payable ? payChargeHref(payable.id) : null,
    };
  });

  const arrears: ArrearBanner[] = charges
    .filter((charge) => charge.status === "open" && (dateOnly(charge.due_date) ?? "") < today)
    .map((charge) => {
      const className = charge.enrollment_id
        ? classNameByEnrollment.get(charge.enrollment_id)
        : undefined;
      const month = monthNominative(dateOnly(charge.period_start) ?? dateOnly(charge.due_date));
      const context = className && month ? `${className}, ${month}` : charge.label;
      return {
        id: charge.id,
        text: arrearsLine(charge.amount_cents, context),
        payHref: payChargeHref(charge.id),
      };
    });

  const bookings = bookingsResult.error
    ? []
    : list(bookingsResult.data as BookingDb[] | null);
  const agenda = await buildOwnedAgenda({
    supabase,
    today,
    windowStart,
    windowEnd,
    enrollments,
    classById,
    classNameByEnrollment,
    people,
    locations,
    cancelledByClass,
    bookings,
  });

  return {
    arrears,
    cards,
    agenda: agenda.items,
    cancellationsNote,
    lessonsNote: agenda.lessonsNote,
  };
});

async function buildOwnedAgenda(input: {
  supabase: AccountContext["supabase"];
  today: string;
  windowStart: string;
  windowEnd: string;
  enrollments: EnrollmentDb[];
  classById: Map<string, ClassDb>;
  classNameByEnrollment: Map<string, string>;
  people: Map<string, MyParticipantRow>;
  locations: Map<string, string>;
  cancelledByClass: Map<string, string[]>;
  bookings: BookingDb[];
}): Promise<{ items: AgendaItem[]; lessonsNote: string | null }> {
  const groups = input.enrollments.flatMap((enrollment) => {
    const danceClass = input.classById.get(enrollment.recurring_class_id);
    if (!danceClass) {
      return [];
    }
    return [
      {
        enrollmentId: enrollment.id,
        classId: danceClass.id,
        title: input.classNameByEnrollment.get(enrollment.id) ?? "Zajęcia",
        place: placeName(danceClass.location_id, input.locations),
        weekday: danceClass.weekday,
        startTime: danceClass.start_time,
        participant: participantLine(input.people.get(enrollment.customer_id)),
        paused: enrollment.status === "paused",
        startedOn: dateOnly(enrollment.started_on) ?? input.today,
        cancelledDates: input.cancelledByClass.get(danceClass.id) ?? [],
      },
    ];
  });

  const slotIds = input.bookings
    .filter((booking) => booking.kind === "slot" && booking.slot_id)
    .map((booking) => booking.slot_id as string);
  const seriesIds = [
    ...new Set(
      input.bookings
        .filter((booking) => booking.kind === "series" && booking.series_id)
        .map((booking) => booking.series_id as string),
    ),
  ];
  const eventIds = input.bookings
    .filter((booking) => booking.kind === "event" && booking.event_id)
    .map((booking) => booking.event_id as string);

  let lessonsNote: string | null = null;
  const slots = new Map<string, { location_id: string; starts_at: string }>();
  if (slotIds.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Sloty są tylko dla admina. Bierzemy wyłącznie id z zapisów tego użytkownika (RLS).
    const admin = createAdminClient();
    const slotResult = await admin
      .from("slots")
      .select("id, location_id, starts_at")
      .in("id", slotIds);
    if (slotResult.error) {
      lessonsNote = "Nie udało się wczytać lekcji indywidualnych.";
    } else {
      for (const row of list(
        slotResult.data as { id: string; location_id: string; starts_at: string }[] | null,
      )) {
        slots.set(row.id, row);
      }
    }
  } else if (slotIds.length > 0) {
    lessonsNote = "Nie udało się wczytać lekcji indywidualnych.";
  }

  const events: EventDb[] = [];
  if (seriesIds.length > 0) {
    const seriesEvents = await input.supabase
      .from("events")
      .select("id, title, location_id, starts_at, series_id, session_no")
      .eq("published", true)
      .in("series_id", seriesIds);
    if (!seriesEvents.error) {
      events.push(...list(seriesEvents.data as EventDb[] | null));
    }
  }
  if (eventIds.length > 0) {
    const singleEvents = await input.supabase
      .from("events")
      .select("id, title, location_id, starts_at, series_id, session_no")
      .eq("published", true)
      .in("id", eventIds);
    if (!singleEvents.error) {
      for (const row of list(singleEvents.data as EventDb[] | null)) {
        if (!events.some((event) => event.id === row.id)) {
          events.push(row);
        }
      }
    }
  }

  const seriesCount = new Map<string, number>();
  for (const event of events) {
    if (!event.series_id) {
      continue;
    }
    seriesCount.set(event.series_id, (seriesCount.get(event.series_id) ?? 0) + 1);
  }

  const windowStartMs = Date.parse(input.windowStart);
  const windowEndMs = Date.parse(input.windowEnd);
  const inWindow = (iso: string) => {
    const at = Date.parse(iso);
    return at >= windowStartMs && at < windowEndMs;
  };

  const extras = [
    ...input.bookings.flatMap((booking) => {
      if (booking.kind !== "slot" || !booking.slot_id) {
        return [];
      }
      const slot = slots.get(booking.slot_id);
      if (!slot || !inWindow(slot.starts_at)) {
        return [];
      }
      const person = booking.customer_id
        ? participantLine(input.people.get(booking.customer_id))
        : null;
      return [
        {
          id: booking.id,
          startsAt: slot.starts_at,
          title: booking.dance_type || "Lekcja indywidualna",
          place: placeName(slot.location_id, input.locations),
          detail: person,
        },
      ];
    }),
    ...events.flatMap((event) => {
      if (!inWindow(event.starts_at)) {
        return [];
      }
      const total = event.series_id ? seriesCount.get(event.series_id) : undefined;
      const detail =
        event.session_no && total ? `${event.session_no}/${total}` : null;
      return [
        {
          id: event.id,
          startsAt: event.starts_at,
          title: event.title,
          place: placeName(event.location_id, input.locations),
          detail,
        },
      ];
    }),
  ];

  return {
    items: buildAgenda({
      todayIso: input.today,
      dayCount: 14,
      groups,
      extras,
    }),
    lessonsNote,
  };
}

export const loadChargeList = cache(async (): Promise<ChargeListItem[] | null> => {
  const { supabase } = await requireAccount();
  const today = warsawTodayIso();
  const { data, error } = await supabase
    .from("charges")
    .select(CHARGE_COLUMNS)
    .order("due_date", { ascending: true });

  if (error) {
    return null;
  }

  const rows = list(data as ChargeDb[] | null);
  const rank = { open: 0, paid: 1, void: 2 } as const;
  return rows
    .slice()
    .sort((left, right) => {
      const byStatus = rank[left.status] - rank[right.status];
      if (byStatus !== 0) {
        return byStatus;
      }
      return left.due_date.localeCompare(right.due_date);
    })
    .map((row) => toChargeListItem(row, today));
});

export async function loadChargeForPayment(chargeId: string): Promise<ChargeListItem | null> {
  const { supabase } = await requireAccount();
  const today = warsawTodayIso();
  const { data, error } = await supabase
    .from("charges")
    .select(CHARGE_COLUMNS)
    .eq("id", chargeId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toChargeListItem(data as ChargeDb, today);
}
