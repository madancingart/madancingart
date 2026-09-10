import { notFound } from "next/navigation";
import { CustomerFile } from "@/components/admin/CustomerFile";
import { getCustomerFile } from "@/lib/admin/get-customer";
import { requireAdmin } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCustomerFilePage({ params }: PageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const data = await getCustomerFile(supabase, id);
  if (!data) {
    notFound();
  }

  return <CustomerFile data={data} />;
}
