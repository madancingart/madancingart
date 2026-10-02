import type { Metadata } from "next";
import { ParticipantsManager } from "@/components/account/panel/ParticipantsManager";
import { requireAccount } from "@/lib/account/panel";
import { site } from "@/content/site";
import type { MyParticipantRow } from "@/lib/types";

export const metadata: Metadata = {
  title: `Uczestnicy — ${site.name}`,
};

export default async function ParticipantsPage() {
  const { supabase, user, profile } = await requireAccount();
  const { data, error } = await supabase.rpc("my_participants");

  if (error) {
    return (
      <p role="alert" className="text-sm text-[#E8A0A0]">
        Nie udało się wczytać uczestników. Odśwież stronę.
      </p>
    );
  }

  return (
    <ParticipantsManager
      participants={(data ?? []) as MyParticipantRow[]}
      email={user.email ?? ""}
      phone={profile.phone}
    />
  );
}
