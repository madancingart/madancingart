import { requireAdmin } from "@/lib/admin/require-admin";
import { parseYearMonth } from "@/lib/admin/class-dates";
import {
  getAttendanceReport,
  paymentMethodLabel,
} from "@/lib/admin/get-attendance-report";
import { clockFromDbTime, warsawTodayIso, weekdayLongLabel } from "@/lib/datetime";
import { formatPlnFromCents } from "@/lib/money";

export const dynamic = "force-dynamic";

function csvCell(value: string): string {
  if (/[";\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatAvg(value: number | null): string {
  if (value == null) {
    return "";
  }
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export async function GET(request: Request) {
  const { supabase } = await requireAdmin();
  const url = new URL(request.url);
  const todayMonth = warsawTodayIso().slice(0, 7);
  const monthParam = url.searchParams.get("miesiac") ?? todayMonth;
  const month = parseYearMonth(monthParam) ? monthParam : todayMonth;
  const report = await getAttendanceReport(supabase, month);

  if (!report) {
    return new Response("Nie udało się wczytać raportu.", { status: 400 });
  }

  const summaryHeader = [
    "Lokalizacja",
    "Grupa",
    "Dzień",
    "Godzina",
    "Zajęcia odbyte",
    "Frekwencja średnia",
    "Suma wpłat",
    "Gotówka",
    "Przelew",
    "Stripe",
  ];

  const summaryRows = report.groups.map((group) => {
    const cash =
      group.methodSums.find((item) => item.method === "onsite")?.amountCents ?? 0;
    const transfer =
      group.methodSums.find((item) => item.method === "transfer")?.amountCents ??
      0;
    const stripe =
      group.methodSums.find((item) => item.method === "stripe")?.amountCents ?? 0;
    const total = group.payments.reduce((sum, item) => sum + item.amountCents, 0);
    return [
      group.locationCity,
      group.name,
      weekdayLongLabel(group.weekday),
      clockFromDbTime(group.startTime),
      String(group.heldCount),
      formatAvg(group.averageAttendance),
      formatPlnFromCents(total),
      formatPlnFromCents(cash),
      formatPlnFromCents(transfer),
      formatPlnFromCents(stripe),
    ]
      .map(csvCell)
      .join(";");
  });

  const paymentHeader = [
    "Data wpłaty",
    "Lokalizacja",
    "Grupa",
    "Klient",
    "Etykieta",
    "Kwota",
    "Metoda",
  ];

  const allPayments = [
    ...report.groups.flatMap((group) => group.payments),
    ...report.otherPayments,
  ];

  const paymentRows = allPayments.map((payment) =>
    [
      payment.paidAt,
      payment.locationCity ?? "",
      payment.className ?? "",
      payment.customerName,
      payment.label,
      formatPlnFromCents(payment.amountCents),
      paymentMethodLabel(payment.method),
    ]
      .map(csvCell)
      .join(";"),
  );

  const lines = [
    "Podsumowanie grup",
    summaryHeader.map(csvCell).join(";"),
    ...summaryRows,
    "",
    "Wpłaty",
    paymentHeader.map(csvCell).join(";"),
    ...paymentRows,
  ];

  const body = `\uFEFF${lines.join("\r\n")}`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ewidencja-${month}.csv"`,
    },
  });
}
