import type { User } from "@supabase/supabase-js";
import type { CustomerKind } from "@/lib/types";
import type { createClient } from "@/lib/supabase/server";

type AccountClient = Awaited<ReturnType<typeof createClient>>;

export type PostLoginResult = {
  claimed: number;
  needsProfile: boolean;
};

type RegistrationMetadata = {
  firstName: string;
  lastName: string;
  phone: string;
  interests: string[];
  participantKind: CustomerKind | null;
  participantFirstName: string;
  participantLastName: string;
  partnerFirstName: string;
  partnerLastName: string;
};

const KINDS = new Set<CustomerKind>(["adult", "pair", "child"]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readMetadata(user: User): RegistrationMetadata {
  const raw = user.user_metadata ?? {};
  const kind = text(raw.participant_kind);
  const interests = Array.isArray(raw.interests)
    ? raw.interests.filter((item): item is string => typeof item === "string")
    : [];

  return {
    firstName: text(raw.first_name),
    lastName: text(raw.last_name),
    phone: text(raw.phone),
    interests,
    participantKind: KINDS.has(kind as CustomerKind) ? (kind as CustomerKind) : null,
    participantFirstName: text(raw.participant_first_name),
    participantLastName: text(raw.participant_last_name),
    partnerFirstName: text(raw.partner_first_name),
    partnerLastName: text(raw.partner_last_name),
  };
}

function hasProfileData(meta: RegistrationMetadata): boolean {
  const digits = meta.phone.replace(/\D/g, "");
  return meta.firstName.length >= 2 && meta.lastName.length >= 2 && digits.length >= 9;
}

function participantKinds(data: unknown): string[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    if (
      row &&
      typeof row === "object" &&
      "kind" in row &&
      typeof row.kind === "string"
    ) {
      return [row.kind];
    }
    return [];
  });
}

function hasParticipantData(meta: RegistrationMetadata): boolean {
  if (!meta.participantKind) {
    return false;
  }
  if (meta.participantFirstName.length < 2 || meta.participantLastName.length < 2) {
    return false;
  }
  if (meta.participantKind === "pair") {
    return meta.partnerFirstName.length >= 2 && meta.partnerLastName.length >= 2;
  }
  return true;
}

async function hasProfile(supabase: AccountClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("account_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function postLogin(
  supabase: AccountClient,
  user: User,
): Promise<PostLoginResult> {
  const claimedResult = await supabase.rpc("claim_my_customers");
  const claimed = typeof claimedResult.data === "number" ? claimedResult.data : 0;
  const meta = readMetadata(user);

  let profile = await hasProfile(supabase, user.id);
  if (!profile && hasProfileData(meta)) {
    await supabase.rpc("upsert_my_profile", {
      p_first_name: meta.firstName,
      p_last_name: meta.lastName,
      p_phone: meta.phone,
      p_interests: meta.interests,
    });
    profile = await hasProfile(supabase, user.id);
  }

  if (profile && hasParticipantData(meta) && meta.participantKind) {
    const mine = await supabase.rpc("my_participants");
    const sameKind = participantKinds(mine.data).includes(meta.participantKind);
    if (!sameKind) {
      await supabase.rpc("add_participant", {
        p_kind: meta.participantKind,
        p_first_name: meta.participantFirstName,
        p_last_name: meta.participantLastName,
        p_partner_first_name:
          meta.participantKind === "pair" ? meta.partnerFirstName : null,
        p_partner_last_name:
          meta.participantKind === "pair" ? meta.partnerLastName : null,
      });
    }
  }

  return { claimed, needsProfile: !profile };
}
