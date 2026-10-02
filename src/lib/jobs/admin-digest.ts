import "server-only";

import { site } from "@/content/site";
import { addDays, addMonths, isoWeekday, startOfMonth } from "@/lib/billing/dates";
import { formatBillingZloty, monthNominative } from "@/lib/billing/status";
import { formatDatePl, isoDateDiffDays, toWarsaw } from "@/lib/datetime";
import { sendSchoolNoticeEmail } from "@/lib/email";
import { loadClasses } from "@/lib/jobs/classes";
import { chunk } from "@/lib/jobs/chunk";
import { loadRecipients } from "@/lib/jobs/recipients";
import { warsawStartIso } from "@/lib/jobs/mode";
import {
  blankResult,
  errorText,
  finishResult,
  type JobContext,
  type JobResult,
} from "@/lib/jobs/types";
import { createAdminClient } from "@/lib/supabase/admin";

const METHOD_LABEL: Record<string, string> = {
  stripe: "online",
  onsite: "na sali",
  transfer: "przelew",
  legacy: "wcześniejsze",
};

export async function runAdminDigest(ctx: JobContext): Promise<JobResult> {
  const result = blankResult("admin-digest");
  try {
    const day = Number(ctx.today.slice(8, 10));
    if (isoWeekday(ctx.today) !== 1 && day !== 1) {
      result.skipped = 1;
      return finishResult(result);
    }
    if (await digestAlreadySent(ctx.today)) {
      result.skipped = 1;
      return finishResult(result);
    }
    const text = await buildDigest(ctx.today);
    const subject = `Podsumowanie szkoły, ${formatDatePl(ctx.today)}`;
    if (ctx.mode === "dry-run") {
      ctx.planned.push({
        job: "admin-digest",
        to: site.email,
        name: "Szkoła",
        subject,
        amount: null,
        period: null,
        body: text,
      });
      result.sent = 1;
      return finishResult(result);
    }
    const sent = await sendSchoolNoticeEmail({ to: site.email, subject, text });
    if (!sent) {
      result.errors.push("Nie udało się wysłać podsumowania szkoły.");
      return finishResult(result);
    }
    result.sent = 1;
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_label: "system",
      action: "mail.admin_digest",
      entity: "cron",
      entity_id: ctx.today,
      details: { to: site.email },
    });
  } catch (error) {
    result.errors.push(errorText(error));
  }
  return finishResult(result);
}

async function digestAlreadySent(today: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_log")
    .select("id")
    .eq("action", "mail.admin_digest")
    .eq("entity_id", today)
    .limit(1);
  if (error) {
    throw new Error("Nie udało się sprawdzić podsumowania.");
  }
  return (data ?? []).length > 0;
}

async function buildDigest(today: string): Promise<string> {
  const [arrears, signups, lapsed, unpriced, payments] = await Promise.all([
    loadArrears(today),
    loadSignups(today),
    loadLapsed(),
    loadUnpriced(),
    loadPayments(today),
  ]);
  const lines = [
    `Podsumowanie na ${formatDatePl(today)}`,
    "",
    "Zaległości",
    ...(arrears.length > 0 ? arrears : ["Brak."]),
    "",
    "Nowe zapisy z ostatniego tygodnia",
    ...(signups.length > 0 ? signups : ["Brak."]),
    "",
    "Zapisy wygasłe",
    ...(lapsed.length > 0 ? lapsed : ["Brak."]),
    "",
    "Grupy bez ceny",
    ...(unpriced.length > 0 ? unpriced : ["Brak."]),
    "",
    `Wpłaty — ${monthNominative(today) ?? "ten miesiąc"}`,
    ...payments,
  ];
  return lines.join("\n");
}

async function loadArrears(today: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("charges")
    .select("customer_id, enrollment_id, amount_cents, due_date, label")
    .eq("status", "open")
    .gt("amount_cents", 0)
    .lt("due_date", today);
  if (error) {
    throw new Error("Nie udało się wczytać zaległości.");
  }
  const rows = (data ?? []) as {
    customer_id: string;
    enrollment_id: string | null;
    amount_cents: number;
    due_date: string;
    label: string;
  }[];
  const enrollments = new Map<string, string>();
  const enrollmentIds = rows
    .map((row) => row.enrollment_id)
    .filter((id): id is string => Boolean(id));
  if (enrollmentIds.length > 0) {
    for (const slice of chunk([...new Set(enrollmentIds)], 100)) {
      const { data: enrollmentRows, error: enrollmentError } = await admin
        .from("enrollments")
        .select("id, recurring_class_id")
        .in("id", slice);
      if (enrollmentError) {
        throw new Error("Nie udało się wczytać zapisów z zaległością.");
      }
      for (const row of (enrollmentRows ?? []) as { id: string; recurring_class_id: string }[]) {
        enrollments.set(row.id, row.recurring_class_id);
      }
    }
  }
  const classes = await loadClasses([...enrollments.values()]);
  const recipients = await loadRecipients(rows.map((row) => row.customer_id));
  const lines = rows
    .map((row) => {
      const person = recipients.get(row.customer_id);
      const classId = row.enrollment_id ? enrollments.get(row.enrollment_id) : undefined;
      const group = (classId ? classes.get(classId)?.name : null) ?? row.label;
      const days = isoDateDiffDays(row.due_date.slice(0, 10), today);
      return {
        days,
        line: `${person?.displayName ?? "Uczestnik"}, ${group}, ${formatBillingZloty(row.amount_cents)}, ${overdueLabel(days)}, ${person?.phone || "brak telefonu"}`,
      };
    })
    .sort((left, right) => right.days - left.days);
  const shown = lines.slice(0, 80).map((item) => item.line);
  if (lines.length > shown.length) {
    shown.push(`oraz ${lines.length - shown.length} kolejnych`);
  }
  return shown;
}

async function loadSignups(today: string): Promise<string[]> {
  const admin = createAdminClient();
  const since = warsawStartIso(addDays(today, -7));
  const { data, error } = await admin
    .from("enrollments")
    .select("customer_id, recurring_class_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("Nie udało się wczytać nowych zapisów.");
  }
  const rows = (data ?? []) as {
    customer_id: string;
    recurring_class_id: string;
    created_at: string;
  }[];
  const [classes, recipients] = await Promise.all([
    loadClasses(rows.map((row) => row.recurring_class_id)),
    loadRecipients(rows.map((row) => row.customer_id)),
  ]);
  return rows.map((row) => {
    const person = recipients.get(row.customer_id)?.displayName ?? "Uczestnik";
    const group = classes.get(row.recurring_class_id)?.name ?? "grupa";
    return `${person}, ${group}, ${formatDatePl(warsawDay(row.created_at))}`;
  });
}

async function loadLapsed(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enrollments")
    .select("customer_id, recurring_class_id")
    .eq("status", "lapsed")
    .order("created_at", { ascending: false })
    .limit(41);
  if (error) {
    throw new Error("Nie udało się wczytać wygasłych zapisów.");
  }
  const rows = (data ?? []) as { customer_id: string; recurring_class_id: string }[];
  const extra = rows.length > 40;
  const shown = extra ? rows.slice(0, 40) : rows;
  const [classes, recipients] = await Promise.all([
    loadClasses(shown.map((row) => row.recurring_class_id)),
    loadRecipients(shown.map((row) => row.customer_id)),
  ]);
  const lines = shown.map((row) => {
    const person = recipients.get(row.customer_id)?.displayName ?? "Uczestnik";
    const group = classes.get(row.recurring_class_id)?.name ?? "grupa";
    return `${person}, ${group}`;
  });
  if (extra) {
    lines.push("oraz kolejne");
  }
  return lines;
}

async function loadUnpriced(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("recurring_classes")
    .select("id, weekday, start_time, location_id, class_type_id")
    .eq("active", true)
    .is("price_item_id", null);
  if (error) {
    throw new Error("Nie udało się wczytać grup bez ceny.");
  }
  const rows = (data ?? []) as { id: string }[];
  const classes = await loadClasses(rows.map((row) => row.id));
  return rows.map((row) => {
    const cls = classes.get(row.id);
    if (!cls) {
      return "Grupa bez nazwy";
    }
    return `${cls.name}, ${cls.location}, ${cls.weekday} ${cls.time}`;
  });
}

async function loadPayments(today: string): Promise<string[]> {
  const admin = createAdminClient();
  const from = warsawStartIso(startOfMonth(today));
  const until = warsawStartIso(addMonths(startOfMonth(today), 1));
  const { data, error } = await admin
    .from("charges")
    .select("amount_cents, payment_method")
    .eq("status", "paid")
    .gte("paid_at", from)
    .lt("paid_at", until);
  if (error) {
    throw new Error("Nie udało się podsumować wpłat.");
  }
  const totals = new Map<string, number>();
  for (const row of (data ?? []) as { amount_cents: number; payment_method: string | null }[]) {
    const key = row.payment_method ?? "inne";
    totals.set(key, (totals.get(key) ?? 0) + row.amount_cents);
  }
  if (totals.size === 0) {
    return ["Brak."];
  }
  const order = ["stripe", "onsite", "transfer", "legacy", "inne"];
  const lines = order
    .filter((key) => totals.has(key))
    .map((key) => `${METHOD_LABEL[key] ?? "inne"}: ${formatBillingZloty(totals.get(key) ?? 0)}`);
  const sum = [...totals.values()].reduce((total, amount) => total + amount, 0);
  lines.push(`Razem: ${formatBillingZloty(sum)}`);
  return lines;
}

function warsawDay(iso: string): string {
  const zoned = toWarsaw(iso);
  const month = String(zoned.getMonth() + 1).padStart(2, "0");
  const day = String(zoned.getDate()).padStart(2, "0");
  return `${zoned.getFullYear()}-${month}-${day}`;
}

function overdueLabel(days: number): string {
  if (days === 1) {
    return "1 dzień po terminie";
  }
  return `${days} dni po terminie`;
}
