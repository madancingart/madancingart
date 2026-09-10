import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPackageActivatedCoupleEmail } from "@/lib/email";
import { formatDatePl, warsawTodayIso } from "@/lib/datetime";
import type { PackagePaymentMethod, PackageStatus } from "@/lib/types";

type PackageForMail = {
  id: string;
  label: string;
  status: PackageStatus;
  customer_id: string;
  wedding_date: string | null;
  songs: string[] | null;
};

type CustomerForMail = {
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  phone: string | null;
  email: string | null;
};

export async function activatePackage(input: {
  supabase: SupabaseClient;
  packageId: string;
  paymentMethod: PackagePaymentMethod;
  stripeSessionId?: string | null;
  actorId: string | null;
  actorLabel: string;
}): Promise<{ ok: true; alreadyActive: boolean } | { ok: false; error: string }> {
  const { data: pkg, error: pkgError } = await input.supabase
    .from("packages")
    .select(
      "id,label,status,customer_id,wedding_date,songs,stripe_checkout_session_id",
    )
    .eq("id", input.packageId)
    .maybeSingle();

  if (pkgError || !pkg) {
    return { ok: false, error: "Nie znaleziono pakietu." };
  }

  const row = pkg as PackageForMail & {
    stripe_checkout_session_id: string | null;
  };

  if (row.status === "cancelled" || row.status === "expired") {
    return { ok: false, error: "Tego pakietu nie można aktywować." };
  }

  if (row.status === "active" || row.status === "completed") {
    return { ok: true, alreadyActive: true };
  }

  const today = warsawTodayIso();
  const { error: updateError } = await input.supabase
    .from("packages")
    .update({
      status: "active",
      paid_at: new Date().toISOString(),
      payment_method: input.paymentMethod,
      valid_from: today,
      stripe_checkout_session_id:
        input.stripeSessionId ?? row.stripe_checkout_session_id,
    })
    .eq("id", row.id)
    .eq("status", "pending_payment");

  if (updateError) {
    return { ok: false, error: "Nie udało się aktywować pakietu." };
  }

  await input.supabase.from("audit_log").insert({
    actor_id: input.actorId,
    actor_label: input.actorLabel,
    action: "package.activated",
    entity: "package",
    entity_id: row.id,
    customer_id: row.customer_id,
    details: { payment_method: input.paymentMethod },
  });

  const { data: customer } = await input.supabase
    .from("customers")
    .select(
      "first_name,last_name,partner_first_name,partner_last_name,phone,email",
    )
    .eq("id", row.customer_id)
    .maybeSingle();

  const person = customer as CustomerForMail | null;
  if (person?.email) {
    await sendPackageActivatedCoupleEmail({
      firstName: person.first_name,
      lastName: person.last_name,
      partnerFirstName: person.partner_first_name ?? "",
      partnerLastName: person.partner_last_name ?? "",
      phone: person.phone ?? "",
      email: person.email,
      packageLabel: row.label,
      weddingDateLabel: row.wedding_date
        ? formatDatePl(row.wedding_date)
        : "—",
      songs: row.songs ?? [],
      paid: true,
    }).catch((reason: unknown) => {
      console.error("Mail aktywacji pakietu nie wyszedł.", reason);
    });
  }

  return { ok: true, alreadyActive: false };
}
