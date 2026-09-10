import { notFound } from "next/navigation";
import { PackageDetail } from "@/components/admin/PackageDetail";
import { requireAdmin } from "@/lib/admin/require-admin";
import { sortTrainers } from "@/lib/trainers";
import type {
  PackagePaymentMethod,
  PackageStatus,
  TrainerRow,
} from "@/lib/types";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CustomerEmbed = {
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  phone: string | null;
  email: string | null;
};

function customerOf(
  value: CustomerEmbed | CustomerEmbed[] | null,
): CustomerEmbed | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function AdminPackageDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const { data: pkg } = await supabase
    .from("packages")
    .select(
      "id,kind,label,status,payment_method,price_cents,total_lessons,wedding_date,songs,valid_from,paid_at,created_at,customer_id,customers(first_name,last_name,partner_first_name,partner_last_name,phone,email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!pkg) {
    notFound();
  }

  const customer = customerOf(
    (pkg as { customers: CustomerEmbed | CustomerEmbed[] | null }).customers,
  );
  if (!customer) {
    notFound();
  }

  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("id,lesson_no,status,slot_id")
    .eq("package_id", id)
    .neq("status", "cancelled")
    .order("lesson_no", { ascending: true });

  const slotIds = (bookingRows ?? [])
    .map((row) => row.slot_id as string | null)
    .filter((value): value is string => Boolean(value));

  const slotsById = new Map<
    string,
    { starts_at: string; location_id: string; trainer_id: string | null }
  >();
  if (slotIds.length > 0) {
    const { data: slots } = await supabase
      .from("slots")
      .select("id,starts_at,location_id,trainer_id")
      .in("id", slotIds);
    for (const slot of slots ?? []) {
      slotsById.set(slot.id as string, {
        starts_at: slot.starts_at as string,
        location_id: slot.location_id as string,
        trainer_id: (slot.trainer_id as string | null) ?? null,
      });
    }
  }

  const { data: trainerRows } = await supabase
    .from("trainers")
    .select("id,name,active")
    .eq("active", true);

  const lessons = (bookingRows ?? []).map((row) => {
    const slot = row.slot_id
      ? slotsById.get(row.slot_id as string)
      : undefined;
    const city = slot
      ? (site.locations.find((item) => item.id === slot.location_id)?.city ??
        slot.location_id)
      : null;
    return {
      id: row.id as string,
      lessonNo: (row.lesson_no as number | null) ?? null,
      status: row.status as string,
      startsAt: slot?.starts_at ?? null,
      locationLabel: city,
      trainerId: slot?.trainer_id ?? null,
    };
  });

  const usedLessons = lessons.length;

  return (
    <PackageDetail
      data={{
        id: pkg.id as string,
        label: pkg.label as string,
        kind: pkg.kind as string,
        status: pkg.status as PackageStatus,
        paymentMethod: (pkg.payment_method as PackagePaymentMethod | null) ?? null,
        priceCents: pkg.price_cents as number,
        totalLessons: (pkg.total_lessons as number | null) ?? null,
        usedLessons,
        weddingDate: (pkg.wedding_date as string | null) ?? null,
        songs: (pkg.songs as string[] | null) ?? [],
        validFrom: (pkg.valid_from as string | null) ?? null,
        paidAt: (pkg.paid_at as string | null) ?? null,
        createdAt: pkg.created_at as string,
        customer: {
          id: pkg.customer_id as string,
          firstName: customer.first_name,
          lastName: customer.last_name,
          partnerFirstName: customer.partner_first_name,
          partnerLastName: customer.partner_last_name,
          phone: customer.phone,
          email: customer.email,
        },
        lessons,
        trainers: sortTrainers((trainerRows ?? []) as TrainerRow[]),
      }}
    />
  );
}
