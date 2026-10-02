import { requireAdmin } from "@/lib/admin/require-admin";
import { parseBookingFilters } from "@/lib/admin/booking-filters";
import { getAdminBookingsExport } from "@/lib/admin/get-bookings";
import {
  createdLabel,
  kindLabel,
  locationLabel,
  paymentLabel,
  personLabel,
  statusLabel,
  subjectLabel,
} from "@/lib/admin/booking-labels";

export const dynamic = "force-dynamic";

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function flatten(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    result[key] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

export async function GET(request: Request) {
  const { supabase } = await requireAdmin();
  const url = new URL(request.url);
  const raw: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const filters = parseBookingFilters(flatten(raw));
  const rows = await getAdminBookingsExport(supabase, { ...filters, page: 1 });

  const header = [
    "Data zapisu",
    "Imię i nazwisko",
    "Telefon",
    "E-mail",
    "Rodzaj",
    "Czego dotyczy",
    "Lokalizacja",
    "Status",
    "Płatność",
  ];

  const lines = [
    header.map(csvCell).join(";"),
    ...rows.map((row) =>
      [
        createdLabel(row.createdAt),
        personLabel(row),
        row.phone ?? "",
        row.email ?? "",
        kindLabel(row.kind),
        subjectLabel(row),
        locationLabel(row.locationId),
        statusLabel(row.status),
        paymentLabel(row.paymentStatus),
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];

  const body = `\uFEFF${lines.join("\r\n")}`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="zapisy.csv"',
    },
  });
}
