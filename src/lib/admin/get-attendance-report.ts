import "server-only";

import { TZDate } from "@date-fns/tz";
import { site, type LocationId } from "@/content/site";
import { heldClassDates, parseYearMonth } from "@/lib/admin/class-dates";
import { WARSAW_TZ, boundsOfWarsawDay, warsawTodayIso } from "@/lib/datetime";
import type { PackagePaymentMethod } from "@/lib/types";
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

export function paymentMethodLabel(
  method: PackagePaymentMethod | null,
): string {
  if (method === "onsite") {
    return "gotówka";
  }
  if (method === "transfer") {
    return "przelew";
  }
  if (method === "stripe") {
    return "Stripe";
  }
  return "—";
}

export type AttendanceReportPayment = {
  id: string;
  paidAt: string;
  amountCents: number;
  method: PackagePaymentMethod | null;
  label: string;
  customerName: string;
  classId: string | null;
  className: string | null;
  locationId: LocationId | null;
  locationCity: string | null;
};

export type MethodSum = {
  method: PackagePaymentMethod;
  label: string;
  amountCents: number;
  count: number;
};

export type AttendanceReportGroup = {
  classId: string;
  locationId: LocationId;
  locationCity: string;
  name: string;
  weekday: number;
  startTime: string;
  heldCount: number;
  averageAttendance: number | null;
  presentTotal: number;
  payments: AttendanceReportPayment[];
  methodSums: MethodSum[];
};

export type AttendanceReport = {
  month: string;
  from: string;
  until: string;
  groups: AttendanceReportGroup[];
  otherPayments: AttendanceReportPayment[];
  methodTotals: MethodSum[];
};

function isoNoon(isoDate: string): TZDate {
  const [yearPart = "0", monthPart = "1", dayPart = "1"] = isoDate.split("-");
  return new TZDate(
    Number.parseInt(yearPart, 10),
    Number.parseInt(monthPart, 10) - 1,
    Number.parseInt(dayPart, 10),
    12,
    0,
    WARSAW_TZ,
  );
}

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function sumMethods(payments: AttendanceReportPayment[]): MethodSum[] {
  const map = new Map<PackagePaymentMethod, MethodSum>();
  for (const payment of payments) {
    if (!payment.method) {
      continue;
    }
    const current = map.get(payment.method) ?? {
      method: payment.method,
      label: paymentMethodLabel(payment.method),
      amountCents: 0,
      count: 0,
    };
    current.amountCents += payment.amountCents;
    current.count += 1;
    map.set(payment.method, current);
  }
  return [...map.values()].sort((left, right) =>
    left.label.localeCompare(right.label, "pl"),
  );
}

type CustomerEmbed = {
  first_name: string;
  last_name: string;
};

function customerName(
  value: CustomerEmbed | CustomerEmbed[] | null,
): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) {
    return "—";
  }
  return `${row.first_name} ${row.last_name}`.trim();
}

export async function getAttendanceReport(
  supabase: SupabaseClient,
  month: string,
): Promise<AttendanceReport | null> {
  const parsed = parseYearMonth(month);
  if (!parsed) {
    return null;
  }
  const from = `${parsed.year}-${String(parsed.month).padStart(2, "0")}-01`;
  const until = lastDayOfMonth(parsed.year, parsed.month);
  const todayIso = warsawTodayIso();
  const paidFrom = boundsOfWarsawDay(isoNoon(from)).start;
  const paidUntil = boundsOfWarsawDay(isoNoon(until)).end;

  const [classesResult, typesResult] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select(
        "id,location_id,class_type_id,weekday,start_time,level,active",
      )
      .eq("active", true),
    supabase.from("class_types").select("id,name"),
  ]);

  const types = new Map(
    asList(typesResult.data as { id: string; name: string }[] | null).map(
      (type) => [type.id, type.name],
    ),
  );

  const classRows = asList(
    classesResult.data as {
      id: string;
      location_id: string;
      class_type_id: string;
      weekday: number;
      start_time: string;
      level: string | null;
      active: boolean;
    }[] | null,
  ).filter((row) => isLocationId(row.location_id));

  const classIds = classRows.map((row) => row.id);
  const classById = new Map(classRows.map((row) => [row.id, row]));

  const sessionsResult =
    classIds.length > 0
      ? await supabase
          .from("class_sessions")
          .select("id,recurring_class_id,session_date,status")
          .in("recurring_class_id", classIds)
          .gte("session_date", from)
          .lte("session_date", until)
      : { data: [] };

  type SessionRow = {
    id: string;
    recurring_class_id: string;
    session_date: string;
    status: string;
  };
  const sessions = asList(sessionsResult.data as SessionRow[] | null);
  const sessionIds = sessions.map((row) => row.id);

  const attendanceResult =
    sessionIds.length > 0
      ? await supabase
          .from("attendance")
          .select("class_session_id,present")
          .in("class_session_id", sessionIds)
          .eq("present", true)
      : { data: [] };

  const presentBySession = new Map<string, number>();
  for (const row of asList(
    attendanceResult.data as { class_session_id: string; present: boolean }[] | null,
  )) {
    presentBySession.set(
      row.class_session_id,
      (presentBySession.get(row.class_session_id) ?? 0) + 1,
    );
  }

  const cancelledByClass = new Map<string, Set<string>>();
  const sessionByClassDate = new Map<string, SessionRow>();
  for (const session of sessions) {
    sessionByClassDate.set(
      `${session.recurring_class_id}:${session.session_date}`,
      session,
    );
    if (session.status === "cancelled") {
      const set = cancelledByClass.get(session.recurring_class_id) ?? new Set();
      set.add(session.session_date);
      cancelledByClass.set(session.recurring_class_id, set);
    }
  }

  const { data: packageData } = await supabase
    .from("packages")
    .select(
      "id,customer_id,recurring_class_id,label,price_cents,paid_at,payment_method,customers(first_name,last_name)",
    )
    .not("paid_at", "is", null)
    .gte("paid_at", paidFrom.toISOString())
    .lte("paid_at", paidUntil.toISOString())
    .order("paid_at", { ascending: true });

  type PackageRow = {
    id: string;
    customer_id: string;
    recurring_class_id: string | null;
    label: string;
    price_cents: number;
    paid_at: string;
    payment_method: PackagePaymentMethod | null;
    customers: CustomerEmbed | CustomerEmbed[] | null;
  };

  const allPayments: AttendanceReportPayment[] = asList(
    packageData as PackageRow[] | null,
  ).map((row) => {
    const classRow = row.recurring_class_id
      ? classById.get(row.recurring_class_id)
      : undefined;
    const locationId = classRow?.location_id;
    return {
      id: row.id,
      paidAt: row.paid_at,
      amountCents: row.price_cents,
      method: row.payment_method,
      label: row.label,
      customerName: customerName(row.customers),
      classId: row.recurring_class_id,
      className: classRow
        ? (types.get(classRow.class_type_id) ?? "Zajęcia")
        : null,
      locationId: locationId && isLocationId(locationId) ? locationId : null,
      locationCity: locationId ? cityOf(locationId) : null,
    };
  });

  const paymentsByClass = new Map<string, AttendanceReportPayment[]>();
  const otherPayments: AttendanceReportPayment[] = [];
  for (const payment of allPayments) {
    if (payment.classId && classById.has(payment.classId)) {
      const list = paymentsByClass.get(payment.classId) ?? [];
      list.push(payment);
      paymentsByClass.set(payment.classId, list);
    } else {
      otherPayments.push(payment);
    }
  }

  const locationRank: Record<LocationId, number> = {
    mikolow: 0,
    lubliniec: 1,
  };

  const groups: AttendanceReportGroup[] = classRows
    .map((row) => {
      const locationId = row.location_id as LocationId;
      const cancelled = cancelledByClass.get(row.id) ?? new Set();
      const held = heldClassDates({
        year: parsed.year,
        month: parsed.month,
        weekday: row.weekday,
        todayIso,
        cancelledDates: cancelled,
      });
      let presentTotal = 0;
      for (const date of held) {
        const session = sessionByClassDate.get(`${row.id}:${date}`);
        if (session && session.status !== "cancelled") {
          presentTotal += presentBySession.get(session.id) ?? 0;
        }
      }
      const payments = paymentsByClass.get(row.id) ?? [];
      return {
        classId: row.id,
        locationId,
        locationCity: cityOf(locationId),
        name: types.get(row.class_type_id) ?? "Zajęcia",
        weekday: row.weekday,
        startTime: row.start_time,
        heldCount: held.length,
        averageAttendance:
          held.length > 0 ? presentTotal / held.length : null,
        presentTotal,
        payments,
        methodSums: sumMethods(payments),
      };
    })
    .sort((left, right) => {
      const loc = locationRank[left.locationId] - locationRank[right.locationId];
      if (loc !== 0) {
        return loc;
      }
      if (left.weekday !== right.weekday) {
        return left.weekday - right.weekday;
      }
      return left.startTime.localeCompare(right.startTime);
    });

  return {
    month,
    from,
    until,
    groups,
    otherPayments,
    methodTotals: sumMethods(allPayments),
  };
}
