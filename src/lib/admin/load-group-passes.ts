import "server-only";

import type { PackageKind, PackagePaymentMethod, PackageStatus } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GROUP_PASS_KINDS } from "@/lib/billing/status";

export type GroupPackageRow = {
  id: string;
  customer_id: string;
  recurring_class_id: string | null;
  kind: PackageKind;
  label: string;
  status: PackageStatus;
  valid_from: string | null;
  valid_until: string | null;
  total_lessons: number | null;
  paid_at: string | null;
  payment_method: PackagePaymentMethod | null;
  price_cents: number;
};

export async function loadGroupPassData(
  supabase: SupabaseClient,
  customerIds: string[],
): Promise<{
  packages: GroupPackageRow[];
  usedByPackageId: Map<string, number>;
}> {
  const unique = [...new Set(customerIds.filter(Boolean))];
  if (unique.length === 0) {
    return { packages: [], usedByPackageId: new Map() };
  }

  const { data } = await supabase
    .from("packages")
    .select(
      "id,customer_id,recurring_class_id,kind,label,status,valid_from,valid_until,total_lessons,paid_at,payment_method,price_cents",
    )
    .in("customer_id", unique)
    .in("kind", [...GROUP_PASS_KINDS]);

  const packages = (data ?? []) as GroupPackageRow[];
  const packageIds = packages.map((row) => row.id);
  const usedByPackageId = new Map<string, number>();

  if (packageIds.length > 0) {
    const { data: attendance } = await supabase
      .from("attendance")
      .select("package_id")
      .in("package_id", packageIds)
      .eq("present", true);

    for (const row of attendance ?? []) {
      const id = row.package_id as string | null;
      if (!id) {
        continue;
      }
      usedByPackageId.set(id, (usedByPackageId.get(id) ?? 0) + 1);
    }
  }

  return { packages, usedByPackageId };
}
