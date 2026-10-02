import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountScreen } from "@/components/account/AccountScreen";
import { LoginForm } from "@/components/account/LoginForm";
import { firstParam } from "@/lib/account/params";
import { safeNextPath } from "@/lib/account/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Logowanie",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; blad?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }

  return (
    <AccountScreen script="Witaj z powrotem" title="Zaloguj się">
      <LoginForm next={next} expiredLink={firstParam(params.blad) === "link"} />
    </AccountScreen>
  );
}
