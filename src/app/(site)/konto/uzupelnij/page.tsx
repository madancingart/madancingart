import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountScreen } from "@/components/account/AccountScreen";
import {
  CompleteProfileForm,
  type ProfilePrefill,
} from "@/components/account/CompleteProfileForm";
import { listClassTypes } from "@/lib/account/class-types";
import { firstParam } from "@/lib/account/params";
import { safeNextPath } from "@/lib/account/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Uzupełnij profil",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function CompleteProfilePage({
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

  if (!user) {
    redirect(`/konto/logowanie?next=${encodeURIComponent("/konto/uzupelnij")}`);
  }

  const [{ data: profile }, participants, classTypes] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("first_name, last_name, phone, interests")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("my_participants"),
    listClassTypes(),
  ]);

  const linked = Array.isArray(participants.data) ? participants.data[0] : null;
  const linkedRow =
    linked && typeof linked === "object"
      ? (linked as {
          first_name?: string;
          last_name?: string;
          phone?: string | null;
        })
      : null;
  const meta = user.user_metadata ?? {};
  const interests = Array.isArray(profile?.interests)
    ? profile.interests.filter((item): item is string => typeof item === "string")
    : Array.isArray(meta.interests)
      ? meta.interests.filter((item): item is string => typeof item === "string")
      : [];

  const prefill: ProfilePrefill = {
    firstName: text(profile?.first_name) || text(linkedRow?.first_name) || text(meta.first_name),
    lastName: text(profile?.last_name) || text(linkedRow?.last_name) || text(meta.last_name),
    phone: text(profile?.phone) || text(linkedRow?.phone) || text(meta.phone),
    interests,
  };

  return (
    <AccountScreen script="Jeszcze chwila" title="Uzupełnij profil">
      <CompleteProfileForm next={next} prefill={prefill} classTypes={classTypes} />
    </AccountScreen>
  );
}
