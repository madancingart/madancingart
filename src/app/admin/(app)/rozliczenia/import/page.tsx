import Link from "next/link";
import { ImportPreview } from "@/components/admin/billing/ImportPreview";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getBillingBoard } from "@/lib/admin/get-billing";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { supabase } = await requireAdmin();
  const board = await getBillingBoard(supabase, {
    status: "",
    overdue: false,
    locationId: "",
    classId: "",
    month: "",
    method: "",
    query: "",
  });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/rozliczenia" className="text-[13px] text-gold hover:text-gold-light">
        Wróć do rozliczeń
      </Link>
      <h1 className="text-[15px] font-semibold text-cream">Import opłaconych klientów</h1>
      <p className="text-[13px] text-muted">
        Jeden błąd wycofuje cały import. Zaproszenia do kont wysyłasz osobno z kartoteki.
      </p>
      <ImportPreview codes={board.groups.map((group) => ({ code: group.code, label: group.label }))} />
    </div>
  );
}
