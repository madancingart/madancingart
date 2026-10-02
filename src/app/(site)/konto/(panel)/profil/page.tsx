import type { Metadata } from "next";
import { ProfileSettings } from "@/components/account/panel/ProfileSettings";
import { requireAccount } from "@/lib/account/panel";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `Profil — ${site.name}`,
};

export default async function ProfilePage() {
  const { user, profile } = await requireAccount();

  return (
    <ProfileSettings
      firstName={profile.firstName}
      lastName={profile.lastName}
      phone={profile.phone}
      email={user.email ?? ""}
      interests={profile.interests}
    />
  );
}
