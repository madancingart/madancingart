import type { Metadata } from "next";
import { AccountScreen } from "@/components/account/AccountScreen";
import { NewPasswordForm } from "@/components/account/NewPasswordForm";
import { firstParam } from "@/lib/account/params";
import { safeNextPath } from "@/lib/account/redirect";

export const metadata: Metadata = {
  title: "Nowe hasło",
};

export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next), "/konto");

  return (
    <AccountScreen script="Zacznij od nowa" title="Ustaw hasło">
      <NewPasswordForm next={next} />
    </AccountScreen>
  );
}
