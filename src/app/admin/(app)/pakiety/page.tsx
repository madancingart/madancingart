import { PackagesTable, type PackageListItem } from "@/components/admin/PackagesTable";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { PackageStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type CustomerEmbed = {
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
};

function customerOf(
  value: CustomerEmbed | CustomerEmbed[] | null,
): CustomerEmbed | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function AdminPackagesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("packages")
    .select(
      "id,label,status,wedding_date,songs,total_lessons,price_cents,customer_id,customers(first_name,last_name,partner_first_name,partner_last_name)",
    )
    .order("wedding_date", { ascending: true, nullsFirst: false });

  const rows = data ?? [];
  const ids = rows.map((row) => row.id as string);
  const used = new Map<string, number>();
  if (ids.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("package_id")
      .in("package_id", ids)
      .neq("status", "cancelled");
    for (const row of bookings ?? []) {
      const id = row.package_id as string | null;
      if (!id) {
        continue;
      }
      used.set(id, (used.get(id) ?? 0) + 1);
    }
  }

  const items: PackageListItem[] = rows.map((row) => {
    const customer = customerOf(
      (row as { customers: CustomerEmbed | CustomerEmbed[] | null }).customers,
    );
    return {
      id: row.id as string,
      customerId: (row.customer_id as string | null) ?? null,
      label: row.label as string,
      status: row.status as PackageStatus,
      weddingDate: (row.wedding_date as string | null) ?? null,
      songs: (row.songs as string[] | null) ?? [],
      totalLessons: (row.total_lessons as number | null) ?? null,
      usedLessons: used.get(row.id as string) ?? 0,
      priceCents: row.price_cents as number,
      firstName: customer?.first_name ?? "—",
      lastName: customer?.last_name ?? "",
      partnerFirstName: customer?.partner_first_name ?? null,
      partnerLastName: customer?.partner_last_name ?? null,
    };
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-cream">Pakiety</h1>
      <PackagesTable items={items} />
    </div>
  );
}
