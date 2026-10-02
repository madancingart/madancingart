"use server";

import { redirect } from "next/navigation";
import { pathAfterLogin, safeNextPath } from "@/lib/account/redirect";
import { postLogin } from "@/lib/account/post-login";
import { publicSiteUrl } from "@/lib/booking/confirmation-window";
import { sendAccountDeletionRequestEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function signInAccount(input: {
  email: string;
  password: string;
  next: string;
  captchaToken?: string;
}): Promise<{ ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    options: { captchaToken: input.captchaToken },
  });

  if (error) {
    return { ok: false, error: "Nieprawidłowy e-mail albo hasło." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Nieprawidłowy e-mail albo hasło." };
  }

  const result = await postLogin(supabase, user);
  const allowed = [new URL(publicSiteUrl()).origin];
  redirect(pathAfterLogin(result, safeNextPath(input.next, "/konto", allowed)));
}

export async function saveNewPassword(input: {
  password: string;
  next: string;
}): Promise<{ ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Link wygasł albo był już użyty — wyślij nowy.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    return {
      ok: false,
      error: "Nie udało się zapisać hasła. Wyślij link jeszcze raz.",
    };
  }

  const result = await postLogin(supabase, user);
  redirect(pathAfterLogin(result, safeNextPath(input.next, "/konto")));
}

export async function requestAccountDeletion(): Promise<
  { ok: true; mailed: boolean } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Zaloguj się ponownie." };
  }

  const { data } = await supabase
    .from("account_profiles")
    .select("first_name, last_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = data as {
    first_name: string;
    last_name: string;
    phone: string;
  } | null;

  if (!profile) {
    return { ok: false, error: "Uzupełnij profil, zanim wyślesz prośbę." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Nie udało się zapisać prośby. Zadzwoń do szkoły." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: user.id,
    actor_label: "client",
    action: "account.deletion_requested",
    entity: "account",
    entity_id: user.id,
    details: {
      email: user.email ?? null,
      first_name: profile.first_name,
      last_name: profile.last_name,
    },
  });

  if (error) {
    console.error("Nie udało się zapisać prośby o usunięcie konta.", error);
    return { ok: false, error: "Nie udało się zapisać prośby. Spróbuj za chwilę." };
  }

  const mailed = await sendAccountDeletionRequestEmail({
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: user.email ?? "",
    phone: profile.phone,
    userId: user.id,
  });

  return { ok: true, mailed: mailed.ok };
}
