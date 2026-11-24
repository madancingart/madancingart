import { PricingManager } from "@/components/admin/pricing/PricingManager";
import { requireAdmin } from "@/lib/admin/require-admin";
import { loadAllPriceItemsAdmin } from "@/lib/pricing/db";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LocatedPriceItem } from "@/content/pricing";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("price_items")
    .select(
      "id,location_id,section,label,detail,amount_cents,unit,note,billing,sort_order,active,prepaid_months,prepaid_amount_cents,prepaid_label",
    )
    .order("location_id")
    .order("sort_order")
    .order("id");

  const items: (LocatedPriceItem & { active: boolean })[] =
    (data ?? []).map((row) => {
      const r = row as {
        id: string;
        location_id: "mikolow" | "lubliniec";
        section: string;
        label: string;
        detail: string | null;
        amount_cents: number;
        unit: LocatedPriceItem["unit"];
        note: string | null;
        billing: LocatedPriceItem["billing"];
        active: boolean;
        prepaid_months: number | null;
        prepaid_amount_cents: number | null;
        prepaid_label: string | null;
      };
      return {
        id: r.id,
        locationId: r.location_id,
        section: r.section,
        label: r.label,
        detail: r.detail ?? undefined,
        amountCents: r.amount_cents,
        unit: r.unit,
        note: r.note ?? undefined,
        billing: r.billing,
        active: r.active,
        prepaid:
          r.prepaid_months === 3 &&
          r.prepaid_amount_cents != null &&
          r.prepaid_label
            ? {
                months: 3 as const,
                amountCents: r.prepaid_amount_cents,
                label: r.prepaid_label,
              }
            : undefined,
      };
    }) ?? (await loadAllPriceItemsAdmin()).map((item) => ({ ...item, active: true }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-cream">Cennik</h1>
      <p className="mt-2 text-[14px] text-muted">
        Edytuj kwoty i dodawaj pozycje. Zmiany idą od razu na stronę publiczną i do
        rozliczeń grup (kwoty zawsze liczy serwer).
      </p>
      <div className="mt-6">
        <PricingManager items={items} />
      </div>
    </div>
  );
}
