import { notFound } from "next/navigation";
import { GroupDetailView } from "@/components/admin/GroupDetailView";
import { getAdminGroup } from "@/lib/admin/get-group";
import { requireAdmin } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminGroupPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const data = await getAdminGroup(supabase, id);
  if (!data) {
    notFound();
  }
  return <GroupDetailView data={data} />;
}
