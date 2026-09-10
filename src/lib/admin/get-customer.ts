import "server-only";

import { isWeddingPackageKind } from "@/content/packages";
import {
  customerDisplayName,
  type CustomerNameInput,
} from "@/lib/admin/customer-label";
import {
  adminCalendarHref,
  weekOffsetFromIso,
} from "@/lib/admin/calendar-url";
import { statusLabel } from "@/lib/admin/booking-labels";
import { formatDateTimeWarsaw, nowInWarsaw } from "@/lib/datetime";
import { isGroupPassKind } from "@/lib/membership-status";
import type { LocationId } from "@/content/site";
import type { AdminTrainer } from "@/lib/admin/calendar-types";
import type {
  BookingKind,
  BookingStatus,
  CustomerKind,
  PackageKind,
  PackagePaymentMethod,
  PackageStatus,
  TrainerRow,
} from "@/lib/types";
import { sortTrainers } from "@/lib/trainers";
import type { SupabaseClient } from "@supabase/supabase-js";

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asLocationId(value: string | null | undefined): LocationId | null {
  if (value === "mikolow" || value === "lubliniec") {
    return value;
  }
  return null;
}

export type CustomerFileRecord = CustomerNameInput & {
  id: string;
  kind: CustomerKind;
  firstName: string;
  lastName: string;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  displayName: string;
};

export type CustomerPackageCard = {
  id: string;
  kind: PackageKind;
  label: string;
  status: PackageStatus;
  totalLessons: number | null;
  usedEntries: number;
  validFrom: string | null;
  validUntil: string | null;
  priceCents: number;
  paidAt: string | null;
  paymentMethod: PackagePaymentMethod | null;
  isGroup: boolean;
  isWedding: boolean;
  classId: string | null;
  classSlug: string | null;
  className: string | null;
  locationId: LocationId | null;
  durationMin: number | null;
  bookingId: string | null;
};

export type CustomerClassEnrollment = {
  bookingId: string;
  classId: string;
  classSlug: string;
  className: string;
  locationId: LocationId;
  durationMin: number;
};

export type CustomerHistoryKind = "booking" | "attendance" | "payment" | "audit";

export type CustomerHistoryItem = {
  id: string;
  at: string;
  atLabel: string;
  kind: CustomerHistoryKind;
  title: string;
  detail: string | null;
  href: string | null;
};

export type CustomerFileData = {
  customer: CustomerFileRecord;
  packages: CustomerPackageCard[];
  enrollments: CustomerClassEnrollment[];
  trainers: AdminTrainer[];
  history: CustomerHistoryItem[];
};

type ClassTypeEmbed = { name: string; slug: string };
type RecurringEmbed = {
  id: string;
  location_id: string;
  duration_min: number;
  class_types: ClassTypeEmbed | ClassTypeEmbed[] | null;
};
type SlotEmbed = {
  id: string;
  starts_at: string;
  ends_at: string;
  location_id: string;
};
type EventEmbed = {
  id: string;
  starts_at: string;
  ends_at: string;
  title: string;
  location_id: string | null;
};
type SessionEmbed = {
  session_date: string;
  status: string;
  recurring_class_id: string;
  recurring_classes: RecurringEmbed | RecurringEmbed[] | null;
};

const AUDIT_LABELS: Record<string, string> = {
  "booking.confirmed_phone": "Potwierdzenie telefoniczne",
  "reminder.sent": "Wysłano przypomnienie",
  "booking.auto_released": "Automatycznie zwolniono termin",
  "attendance.drop_in": "Dopisano na zajęcia",
  "class_session.cancelled": "Odwołano zajęcia",
  "class_session.cancelled_notified": "Powiadomiono o odwołaniu zajęć",
  "payment.recorded": "Odnotowano wpłatę",
  "package.activated": "Aktywowano pakiet",
  "booking.moved": "Przeniesiono rezerwację",
  "booking.cancelled": "Odwołano rezerwację",
};

export async function getCustomerFile(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerFileData | null> {
  const { data: row } = await supabase
    .from("customers")
    .select(
      "id,kind,first_name,last_name,partner_first_name,partner_last_name,guardian_name,guardian_phone,phone,email,notes,created_at",
    )
    .eq("id", customerId)
    .maybeSingle();

  if (!row) {
    return null;
  }

  const customer: CustomerFileRecord = {
    id: row.id as string,
    kind: row.kind as CustomerKind,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    partnerFirstName: (row.partner_first_name as string | null) ?? null,
    partnerLastName: (row.partner_last_name as string | null) ?? null,
    guardianName: (row.guardian_name as string | null) ?? null,
    guardianPhone: (row.guardian_phone as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    displayName: customerDisplayName({
      kind: row.kind as CustomerKind,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      partnerFirstName: (row.partner_first_name as string | null) ?? null,
      partnerLastName: (row.partner_last_name as string | null) ?? null,
      guardianName: (row.guardian_name as string | null) ?? null,
    }),
  };

  const [
    packagesResult,
    bookingsResult,
    attendanceResult,
    auditResult,
    trainersResult,
  ] = await Promise.all([
    supabase
      .from("packages")
      .select(
        "id,kind,label,status,total_lessons,valid_from,valid_until,price_cents,paid_at,payment_method,recurring_class_id,created_at",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select(
        "id,kind,status,confirmed_at,created_at,slot_id,event_id,recurring_class_id,package_id,lesson_no,slots(id,starts_at,ends_at,location_id),events(id,starts_at,ends_at,title,location_id),recurring_classes(id,location_id,duration_min,class_types(name,slug))",
      )
      .eq("customer_id", customerId),
    supabase
      .from("attendance")
      .select(
        "id,present,created_at,package_id,class_sessions(session_date,status,recurring_class_id,recurring_classes(id,location_id,duration_min,class_types(name,slug)))",
      )
      .eq("customer_id", customerId),
    supabase
      .from("audit_log")
      .select("id,action,entity,entity_id,details,created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase.from("trainers").select("id,name,active").eq("active", true),
  ]);

  const classById = new Map<string, RecurringEmbed>();
  const enrollments: CustomerClassEnrollment[] = [];
  const bookingIdByClass = new Map<string, string>();
  const usedByPackageId = new Map<string, number>();
  const nowIso = nowInWarsaw().toISOString();
  const history: CustomerHistoryItem[] = [];

  for (const booking of bookingsResult.data ?? []) {
    const classEmbed = asOne(
      booking.recurring_classes as RecurringEmbed | RecurringEmbed[] | null,
    );
    if (classEmbed) {
      classById.set(classEmbed.id, classEmbed);
    }
    const kind = booking.kind as BookingKind;
    const status = booking.status as BookingStatus;
    if (
      kind === "class" &&
      status !== "cancelled" &&
      classEmbed &&
      asLocationId(classEmbed.location_id)
    ) {
      const type = asOne(classEmbed.class_types);
      const locationId = asLocationId(classEmbed.location_id);
      if (locationId) {
        bookingIdByClass.set(classEmbed.id, booking.id as string);
        enrollments.push({
          bookingId: booking.id as string,
          classId: classEmbed.id,
          classSlug: type?.slug ?? "",
          className: type?.name ?? "Zajęcia",
          locationId,
          durationMin: classEmbed.duration_min,
        });
      }
    }
    const pkgId = booking.package_id as string | null;
    if (pkgId && status !== "cancelled" && kind !== "class") {
      usedByPackageId.set(pkgId, (usedByPackageId.get(pkgId) ?? 0) + 1);
    }

    const slot = asOne(booking.slots as SlotEmbed | SlotEmbed[] | null);
    const event = asOne(booking.events as EventEmbed | EventEmbed[] | null);
    const at =
      slot?.starts_at ?? event?.starts_at ?? (booking.created_at as string);
    const confirmedAt = booking.confirmed_at as string | null;
    const confirmed =
      confirmedAt != null
        ? "potwierdzono obecność"
        : status === "cancelled"
          ? null
          : "bez potwierdzenia";
    const detailParts = [statusLabel(status), confirmed].filter(Boolean);
    history.push({
      id: `booking-${booking.id}`,
      at,
      atLabel: formatDateTimeWarsaw(at),
      kind: "booking",
      title:
        kind === "event"
          ? (event?.title ?? "Wydarzenie")
          : kind === "class"
            ? (asOne(classEmbed?.class_types)?.name ?? "Zajęcia grupowe")
            : "Lekcja indywidualna",
      detail: detailParts.join(" · "),
      href: historyHref({
        kind,
        slot,
        event,
        classId: classEmbed?.id ?? (booking.recurring_class_id as string | null),
        nowIso,
      }),
    });
  }

  for (const row of attendanceResult.data ?? []) {
    const pkgId = row.package_id as string | null;
    if (pkgId && row.present) {
      usedByPackageId.set(pkgId, (usedByPackageId.get(pkgId) ?? 0) + 1);
    }
  }

  const missingClassIds = [
    ...new Set(
      (packagesResult.data ?? [])
        .map((pkg) => pkg.recurring_class_id as string | null)
        .filter((id): id is string => typeof id === "string" && !classById.has(id)),
    ),
  ];
  if (missingClassIds.length > 0) {
    const { data: classRows } = await supabase
      .from("recurring_classes")
      .select("id,location_id,duration_min,class_types(name,slug)")
      .in("id", missingClassIds);
    for (const item of classRows ?? []) {
      classById.set(item.id as string, item as RecurringEmbed);
    }
  }

  const packages: CustomerPackageCard[] = (packagesResult.data ?? []).map(
    (pkg) => {
      const classId = (pkg.recurring_class_id as string | null) ?? null;
      const classEmbed = classId ? classById.get(classId) : undefined;
      const type = classEmbed ? asOne(classEmbed.class_types) : null;
      const kind = pkg.kind as PackageKind;
      return {
        id: pkg.id as string,
        kind,
        label: pkg.label as string,
        status: pkg.status as PackageStatus,
        totalLessons: (pkg.total_lessons as number | null) ?? null,
        usedEntries: usedByPackageId.get(pkg.id as string) ?? 0,
        validFrom: (pkg.valid_from as string | null) ?? null,
        validUntil: (pkg.valid_until as string | null) ?? null,
        priceCents: pkg.price_cents as number,
        paidAt: (pkg.paid_at as string | null) ?? null,
        paymentMethod: (pkg.payment_method as PackagePaymentMethod | null) ?? null,
        isGroup: isGroupPassKind(kind),
        isWedding: isWeddingPackageKind(kind),
        classId,
        classSlug: type?.slug ?? null,
        className: type?.name ?? null,
        locationId: classEmbed ? asLocationId(classEmbed.location_id) : null,
        durationMin: classEmbed?.duration_min ?? null,
        bookingId: classId ? (bookingIdByClass.get(classId) ?? null) : null,
      };
    },
  );

  for (const row of attendanceResult.data ?? []) {
    const session = asOne(row.class_sessions as SessionEmbed | SessionEmbed[] | null);
    if (!session) {
      continue;
    }
    const classEmbed = asOne(session.recurring_classes);
    const type = classEmbed ? asOne(classEmbed.class_types) : null;
    const at = `${session.session_date}T12:00:00+02:00`;
    history.push({
      id: `attendance-${row.id}`,
      at,
      atLabel: formatDateTimeWarsaw(at),
      kind: "attendance",
      title: type?.name ?? "Ewidencja",
      detail: row.present ? "obecność" : "nieobecność",
      href: `/admin/ewidencja?grupa=${session.recurring_class_id}&data=${session.session_date}`,
    });
  }

  for (const pkg of packages) {
    if (!pkg.paidAt) {
      continue;
    }
    history.push({
      id: `payment-${pkg.id}`,
      at: pkg.paidAt,
      atLabel: formatDateTimeWarsaw(pkg.paidAt),
      kind: "payment",
      title: pkg.label,
      detail: "wpłata odnotowana",
      href: pkg.isWedding ? `/admin/pakiety/${pkg.id}` : pkg.classId
        ? `/admin/grupy/${pkg.classId}`
        : null,
    });
  }

  for (const row of auditResult.data ?? []) {
    const action = row.action as string;
    history.push({
      id: `audit-${row.id}`,
      at: row.created_at as string,
      atLabel: formatDateTimeWarsaw(row.created_at as string),
      kind: "audit",
      title: AUDIT_LABELS[action] ?? action,
      detail: auditDetail(row.details),
      href: null,
    });
  }

  history.sort((left, right) => right.at.localeCompare(left.at));

  const uniqueEnrollments = dedupeEnrollments(enrollments);

  return {
    customer,
    packages,
    enrollments: uniqueEnrollments,
    trainers: sortTrainers((trainersResult.data ?? []) as TrainerRow[]),
    history,
  };
}

function dedupeEnrollments(
  enrollments: CustomerClassEnrollment[],
): CustomerClassEnrollment[] {
  const seen = new Set<string>();
  const result: CustomerClassEnrollment[] = [];
  for (const item of enrollments) {
    if (seen.has(item.classId)) {
      continue;
    }
    seen.add(item.classId);
    result.push(item);
  }
  return result;
}

function historyHref(input: {
  kind: BookingKind;
  slot: SlotEmbed | null;
  event: EventEmbed | null;
  classId: string | null;
  nowIso: string;
}): string | null {
  if (input.kind === "class" && input.classId) {
    return `/admin/ewidencja?grupa=${input.classId}`;
  }
  if (input.kind === "slot" && input.slot) {
    const locationId = asLocationId(input.slot.location_id);
    if (!locationId) {
      return "/admin/kalendarz";
    }
    return adminCalendarHref({
      locationId,
      weekOffset: weekOffsetFromIso(input.slot.starts_at, input.nowIso),
      kind: "slot",
    });
  }
  if (input.kind === "event") {
    return "/admin/eventy";
  }
  return null;
}

function auditDetail(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["channel", "reason", "from", "to"]) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) {
      parts.push(item);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
