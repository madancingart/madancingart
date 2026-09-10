import "server-only";

import { getISODay } from "date-fns";
import { site, type LocationId } from "@/content/site";
import { journalPassState, type ConsumablePass } from "@/lib/attendance-pass";
import { loadGroupPassData } from "@/lib/admin/load-group-passes";
import type {
  JournalClassOption,
  JournalData,
  JournalPerson,
} from "@/lib/admin/journal-types";
import { nowInWarsaw } from "@/lib/datetime";
import type {
  ClassSessionStatus,
  ClassTypeRow,
  CustomerKind,
  RecurringClassRow,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function asList<T>(value: T[] | null): T[] {
  return value ?? [];
}

function cityOf(locationId: string): string {
  return (
    site.locations.find((item) => item.id === locationId)?.city ?? locationId
  );
}

function isLocationId(value: string): value is LocationId {
  return value === "mikolow" || value === "lubliniec";
}

type CustomerEmbed = {
  kind: CustomerKind;
  partner_first_name: string | null;
  partner_last_name: string | null;
  guardian_name: string | null;
};

function customerFromEmbed(
  value: CustomerEmbed | CustomerEmbed[] | null,
): CustomerEmbed | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function personNameKey(person: JournalPerson): string {
  return `${person.lastName ?? ""} ${person.firstName}`.trim().toLocaleLowerCase(
    "pl",
  );
}

export async function getJournalCatalog(
  supabase: SupabaseClient,
): Promise<JournalClassOption[]> {
  const [classesResult, typesResult] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id,location_id,class_type_id,weekday,start_time,duration_min,level,capacity,signup_open,active,trainer_id",
      )
      .eq("active", true)
      .order("weekday", { ascending: true }),
    supabase.from("class_types").select("id,slug,name,is_pair,color"),
  ]);

  const types = new Map(
    asList(typesResult.data as ClassTypeRow[] | null).map((type) => [
      type.id,
      type,
    ]),
  );

  const options = asList(classesResult.data as RecurringClassRow[] | null)
    .filter((row) => isLocationId(row.location_id))
    .map((row) => {
      const type = types.get(row.class_type_id);
      return {
        id: row.id,
        locationId: row.location_id as LocationId,
        locationCity: cityOf(row.location_id),
        name: type?.name ?? "Zajęcia",
        weekday: row.weekday,
        startTime: row.start_time,
        level: row.level,
      };
    });

  const locationRank: Record<LocationId, number> = {
    mikolow: 0,
    lubliniec: 1,
  };
  options.sort((left, right) => {
    const loc = locationRank[left.locationId] - locationRank[right.locationId];
    if (loc !== 0) {
      return loc;
    }
    if (left.weekday !== right.weekday) {
      return left.weekday - right.weekday;
    }
    return left.startTime.localeCompare(right.startTime);
  });

  return options;
}

export function todayClassChips(
  catalog: JournalClassOption[],
): JournalClassOption[] {
  const weekday = getISODay(nowInWarsaw());
  return catalog.filter((item) => item.weekday === weekday);
}

export async function getOrCreateClassSession(
  supabase: SupabaseClient,
  classId: string,
  sessionDate: string,
): Promise<{
  id: string;
  status: ClassSessionStatus;
  note: string | null;
} | null> {
  const { data: existing } = await supabase
    .from("class_sessions")
    .select("id,status,note")
    .eq("recurring_class_id", classId)
    .eq("session_date", sessionDate)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      status: existing.status as ClassSessionStatus,
      note: (existing.note as string | null) ?? null,
    };
  }

  const { data: inserted, error } = await supabase
    .from("class_sessions")
    .insert({
      recurring_class_id: classId,
      session_date: sessionDate,
      status: "planned",
    })
    .select("id,status,note")
    .single();

  if (!error && inserted) {
    return {
      id: inserted.id as string,
      status: inserted.status as ClassSessionStatus,
      note: (inserted.note as string | null) ?? null,
    };
  }

  const { data: retry } = await supabase
    .from("class_sessions")
    .select("id,status,note")
    .eq("recurring_class_id", classId)
    .eq("session_date", sessionDate)
    .maybeSingle();

  if (!retry) {
    return null;
  }
  return {
    id: retry.id as string,
    status: retry.status as ClassSessionStatus,
    note: (retry.note as string | null) ?? null,
  };
}

export async function getJournal(
  supabase: SupabaseClient,
  classId: string,
  sessionDate: string,
): Promise<JournalData | null> {
  const { data: classRow } = await supabase
    .from("recurring_classes")
    .select(
      "id,location_id,class_type_id,weekday,start_time,duration_min,level,capacity,signup_open,active,trainer_id",
    )
    .eq("id", classId)
    .maybeSingle();

  if (!classRow) {
    return null;
  }

  const row = classRow as RecurringClassRow;
  const { data: typeRow } = await supabase
    .from("class_types")
    .select("id,slug,name,is_pair,color")
    .eq("id", row.class_type_id)
    .maybeSingle();
  const type = typeRow as ClassTypeRow | null;

  const session = await getOrCreateClassSession(supabase, classId, sessionDate);
  if (!session) {
    return null;
  }

  const { data: bookingData } = await supabase
    .from("bookings")
    .select(
      "id,first_name,last_name,phone,email,status,customer_id,customers(kind,partner_first_name,partner_last_name,guardian_name)",
    )
    .eq("recurring_class_id", classId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  type BookingItem = {
    id: string;
    first_name: string;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    status: string;
    customer_id: string | null;
    customers: CustomerEmbed | CustomerEmbed[] | null;
  };

  const bookings = asList(bookingData as BookingItem[] | null);
  const membersByCustomer = new Map<string, BookingItem[]>();
  const membersWithoutCustomer: BookingItem[] = [];

  for (const booking of bookings) {
    if (booking.customer_id) {
      const list = membersByCustomer.get(booking.customer_id) ?? [];
      list.push(booking);
      membersByCustomer.set(booking.customer_id, list);
    } else {
      membersWithoutCustomer.push(booking);
    }
  }

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("id,customer_id,present,package_id")
    .eq("class_session_id", session.id);

  type AttendanceItem = {
    id: string;
    customer_id: string;
    present: boolean;
    package_id: string | null;
  };
  const attendanceByCustomer = new Map(
    asList(attendanceRows as AttendanceItem[] | null).map((item) => [
      item.customer_id,
      item,
    ]),
  );

  const enrolledIds = new Set(membersByCustomer.keys());
  const dropInIds = [...attendanceByCustomer.keys()].filter(
    (id) => !enrolledIds.has(id),
  );

  const extraCustomers =
    dropInIds.length > 0
      ? asList(
          (
            await supabase
              .from("customers")
              .select(
                "id,first_name,last_name,kind,partner_first_name,partner_last_name,guardian_name",
              )
              .in("id", dropInIds)
          ).data as
            | {
                id: string;
                first_name: string;
                last_name: string;
                kind: CustomerKind;
                partner_first_name: string | null;
                partner_last_name: string | null;
                guardian_name: string | null;
              }[]
            | null,
        )
      : [];

  const extraById = new Map(extraCustomers.map((item) => [item.id, item]));

  const allCustomerIds = [
    ...enrolledIds,
    ...dropInIds,
  ];
  const { packages, usedByPackageId } = await loadGroupPassData(
    supabase,
    allCustomerIds,
  );

  function packagesFor(customerId: string): ConsumablePass[] {
    return packages
      .filter((pkg) => pkg.customer_id === customerId)
      .filter((pkg) => pkg.recurring_class_id === classId)
      .map((pkg) => ({
        id: pkg.id,
        kind: pkg.kind,
        status: pkg.status,
        validFrom: pkg.valid_from,
        validUntil: pkg.valid_until,
        totalLessons: pkg.total_lessons,
        usedEntries: usedByPackageId.get(pkg.id) ?? 0,
      }));
  }

  const people: JournalPerson[] = [];

  for (const [customerId, group] of membersByCustomer) {
    const primary = group[0];
    if (!primary) {
      continue;
    }
    const customer = customerFromEmbed(primary.customers);
    const att = attendanceByCustomer.get(customerId);
    const present = att?.present ?? false;
    const packageId = present ? (att?.package_id ?? null) : null;
    const state = journalPassState({
      present,
      packageId,
      packages: packagesFor(customerId),
      sessionDateIso: sessionDate,
    });
    people.push({
      key: customerId,
      customerId,
      bookingId: primary.id,
      firstName: primary.first_name,
      lastName: primary.last_name,
      customerKind: customer?.kind ?? null,
      partnerFirstName: customer?.partner_first_name ?? null,
      partnerLastName: customer?.partner_last_name ?? null,
      guardianName: customer?.guardian_name ?? null,
      dropIn: false,
      present,
      unpaid: state.unpaid,
      remainingLabel: state.remainingLabel,
    });
  }

  for (const booking of membersWithoutCustomer) {
    people.push({
      key: booking.id,
      customerId: null,
      bookingId: booking.id,
      firstName: booking.first_name,
      lastName: booking.last_name,
      customerKind: null,
      partnerFirstName: null,
      partnerLastName: null,
      guardianName: null,
      dropIn: false,
      present: false,
      unpaid: false,
      remainingLabel: null,
    });
  }

  for (const customerId of dropInIds) {
    const extra = extraById.get(customerId);
    const att = attendanceByCustomer.get(customerId);
    const present = att?.present ?? false;
    const packageId = present ? (att?.package_id ?? null) : null;
    const state = journalPassState({
      present,
      packageId,
      packages: packagesFor(customerId),
      sessionDateIso: sessionDate,
    });
    people.push({
      key: customerId,
      customerId,
      bookingId: null,
      firstName: extra?.first_name ?? "Gość",
      lastName: extra?.last_name ?? null,
      customerKind: extra?.kind ?? null,
      partnerFirstName: extra?.partner_first_name ?? null,
      partnerLastName: extra?.partner_last_name ?? null,
      guardianName: extra?.guardian_name ?? null,
      dropIn: true,
      present,
      unpaid: state.unpaid,
      remainingLabel: state.remainingLabel,
    });
  }

  people.sort((left, right) => {
    if (left.dropIn !== right.dropIn) {
      return left.dropIn ? 1 : -1;
    }
    if (left.unpaid !== right.unpaid) {
      return left.unpaid ? -1 : 1;
    }
    return personNameKey(left).localeCompare(personNameKey(right), "pl");
  });

  return {
    classId,
    className: type?.name ?? "Zajęcia",
    locationCity: cityOf(row.location_id),
    weekday: row.weekday,
    startTime: row.start_time,
    level: row.level,
    sessionId: session.id,
    sessionDate,
    sessionStatus: session.status,
    cancelReason: session.note,
    people,
  };
}
