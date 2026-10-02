import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountScreen } from "@/components/account/AccountScreen";
import { RegisterForm } from "@/components/account/RegisterForm";
import { listClassTypes } from "@/lib/account/class-types";
import { firstParam } from "@/lib/account/params";
import { safeNextPath } from "@/lib/account/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Rejestracja",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next), "/konto/witaj");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }
  const classTypes = await listClassTypes();

  return (
    <AccountScreen script="Dołącz do nas" title="Załóż konto">
      <RegisterForm next={next} classTypes={classTypes} />
    </AccountScreen>
  );
}
