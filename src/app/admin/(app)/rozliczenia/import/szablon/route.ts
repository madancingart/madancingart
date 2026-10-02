import { IMPORT_HEADERS } from "@/lib/billing/import-csv";
import { requireAdmin } from "@/lib/admin/require-admin";

export async function GET() {
  await requireAdmin();
  const body = `\uFEFF${IMPORT_HEADERS.join(";")}\r\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="szablon-rozliczenia.csv"',
    },
  });
}
