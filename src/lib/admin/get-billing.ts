import "server-only";

import { site, type LocationId } from "@/content/site";
import { addMonths, startOfMonth } from "@/lib/billing/dates";
import { assignGroupCodes } from "@/lib/billing/group-code";
import { chargeStatusPill, type BillingStatus } from "@/lib/billing/status";
import { customerDisplayName } from "@/lib/admin/customer-label";
import { warsawStartIso } from "@/lib/jobs/mode";
import { warsawTodayIso } from "@/lib/datetime";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingTiles = {
  monthTotalCents: number;
  methods: { key: string; label: string; amountCents: number }[];
  openCount: number;
  openCents: number;
  overdueCount: number;
  overduePeople: number;
  overdueCents: number;
  pendingEnrollments: number;
};

export type ChargeListRow = {
  id: string;
  customerId: string;
  customerName: string;
  className: string;
  classId: string | null;
  locationId: string | null;
  period: string | null;
  amountCents: number;
  dueDate: string;
  status: "open" | "paid" | "void";
  method: string | null;
  reminderStage: number;
  payToken: string;
  pill: BillingStatus;
};

export type GroupOption = {
  id: string;
  code: string;
  label: string;
  locationId: string;
};

const METHOD_LABEL: Record<string, string> = {
  stripe: "online",
  onsite: "gotówka",
  transfer: "przelew",
  legacy: "wcześniejsze",
};

export async function getBillingBoard(
  supabase: SupabaseClient,
  filters: {
    status: string;
    overdue: boolean;
    locationId: string;
    classId: string;
    month: string;
    method: string;
    query: string;
  },
): Promise<{ tiles: BillingTiles; rows: ChargeListRow[]; groups: GroupOption[] }> {
  const today = warsawTodayIso();
  const monthStart = startOfMonth(today);
  const [tiles, groups, rows] = await Promise.all([
    loadTiles(supabase, today, monthStart),
    loadGroups(supabase),
    loadCharges(supabase, today),
  ]);
  const query = filters.query.trim().toLocaleLowerCase("pl");
  const filtered = rows.filter((row) => {
    if (filters.status && row.status !== filters.status) {
      return false;
    }
    if (filters.overdue && !(row.status === "open" && row.dueDate < today)) {
      return false;
    }
    if (filters.locationId && row.locationId !== filters.locationId) {
      return false;
    }
    if (filters.classId && row.classId !== filters.classId) {
      return false;
    }
    if (filters.month && !row.dueDate.startsWith(filters.month) && !(row.period ?? "").startsWith(filters.month)) {
      return false;
    }
    if (filters.method && row.method !== filters.method) {
      return false;
    }
    if (query && !row.customerName.toLocaleLowerCase("pl").includes(query) && !row.className.toLocaleLowerCase("pl").includes(query)) {
      return false;
    }
    return true;
  });
  return { tiles, rows: filtered.slice(0, 300), groups };
}

async function loadTiles(
  supabase: SupabaseClient,
  today: string,
  monthStart: string,
): Promise<BillingTiles> {
  const from = warsawStartIso(monthStart);
  const until = warsawStartIso(addMonths(monthStart, 1));
  const [{ data: paid }, { data: open }, { count: pending }] = await Promise.all([
    supabase
      .from("charges")
      .select("amount_cents, payment_method")
      .eq("status", "paid")
      .gte("paid_at", from)
      .lt("paid_at", until),
    supabase
      .from("charges")
      .select("customer_id, amount_cents, due_date")
      .eq("status", "open")
      .gt("amount_cents", 0),
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  const methods = new Map<string, number>();
  let monthTotalCents = 0;
  for (const row of (paid ?? []) as { amount_cents: number; payment_method: string | null }[]) {
    const key = row.payment_method ?? "legacy";
    methods.set(key, (methods.get(key) ?? 0) + row.amount_cents);
    monthTotalCents += row.amount_cents;
  }
  const openRows = (open ?? []) as {
    customer_id: string;
    amount_cents: number;
    due_date: string;
  }[];
  const overdue = openRows.filter((row) => row.due_date.slice(0, 10) < today);
  return {
    monthTotalCents,
    methods: [...methods.entries()].map(([key, amountCents]) => ({
      key,
      label: METHOD_LABEL[key] ?? key,
      amountCents,
    })),
    openCount: openRows.length,
    openCents: openRows.reduce((sum, row) => sum + row.amount_cents, 0),
    overdueCount: overdue.length,
    overduePeople: new Set(overdue.map((row) => row.customer_id)).size,
    overdueCents: overdue.reduce((sum, row) => sum + row.amount_cents, 0),
    pendingEnrollments: pending ?? 0,
  };
}

async function loadGroups(supabase: SupabaseClient): Promise<GroupOption[]> {
  const { data } = await supabase
    .from("recurring_classes")
    .select("id, location_id, weekday, start_time, class_types(name, slug)")
    .eq("active", true);
  const rows = (data ?? []) as {
    id: string;
    location_id: string;
    weekday: number;
    start_time: string;
    class_types: { name: string; slug: string } | { name: string; slug: string }[] | null;
  }[];
  const codes = assignGroupCodes(
    rows.map((row) => {
      const type = Array.isArray(row.class_types) ? row.class_types[0] : row.class_types;
      return {
        id: row.id,
        locationId: row.location_id,
        weekday: row.weekday,
        startTime: row.start_time,
        slug: type?.slug ?? "grupa",
      };
    }),
  );
  return rows
    .map((row) => {
      const type = Array.isArray(row.class_types) ? row.class_types[0] : row.class_types;
      const city = site.locations.find((item) => item.id === row.location_id)?.city ?? row.location_id;
      return {
        id: row.id,
        code: codes.get(row.id) ?? row.id,
        label: `${city} · ${row.start_time.slice(0, 5)} · ${type?.name ?? "Zajęcia"}`,
        locationId: row.location_id,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pl"));
}

async function loadCharges(supabase: SupabaseClient, today: string): Promise<ChargeListRow[]> {
  const { data } = await supabase
    .from("charges")
    .select(
      "id, customer_id, label, period_start, period_end, amount_cents, due_date, status, payment_method, reminder_stage, pay_token, customers(first_name, last_name, kind, partner_first_name, partner_last_name, guardian_name), enrollments(recurring_class_id, recurring_classes(location_id, class_types(name)))",
    )
    .order("due_date", { ascending: true })
    .limit(800);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const customer = one(row.customers) as {
      first_name: string;
      last_name: string;
      kind: "adult" | "pair" | "child";
      partner_first_name: string | null;
      partner_last_name: string | null;
      guardian_name: string | null;
    } | null;
    const enrollment = one(row.enrollments) as {
      recurring_class_id: string;
      recurring_classes: { location_id: string; class_types: { name: string } | { name: string }[] | null } | { location_id: string; class_types: { name: string } | { name: string }[] | null }[] | null;
    } | null;
    const cls = enrollment ? one(enrollment.recurring_classes) : null;
    const type = cls ? one(cls.class_types) : null;
    const dueDate = String(row.due_date).slice(0, 10);
    const status = row.status as "open" | "paid" | "void";
    const periodStart = row.period_start ? String(row.period_start).slice(0, 10) : null;
    const periodEnd = row.period_end ? String(row.period_end).slice(0, 10) : null;
    return {
      id: String(row.id),
      customerId: String(row.customer_id),
      customerName: customer
        ? customerDisplayName({
            kind: customer.kind,
            firstName: customer.first_name,
            lastName: customer.last_name,
            partnerFirstName: customer.partner_first_name,
            partnerLastName: customer.partner_last_name,
            guardianName: customer.guardian_name,
          })
        : "Uczestnik",
      className: type?.name ?? String(row.label),
      classId: enrollment?.recurring_class_id ?? null,
      locationId: (cls?.location_id as LocationId | undefined) ?? null,
      period: periodStart && periodEnd ? `${periodStart} – ${periodEnd}` : null,
      amountCents: Number(row.amount_cents),
      dueDate,
      status,
      method: (row.payment_method as string | null) ?? null,
      reminderStage: Number(row.reminder_stage ?? 0),
      payToken: String(row.pay_token),
      pill: chargeStatusPill(status, dueDate, today),
    };
  });
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
