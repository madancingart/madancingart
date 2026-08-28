"use server";

import { redirect } from "next/navigation";
import { polishAuthError, resolveAdminLogin } from "@/lib/admin/login";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function signInAdmin(
  login: string,
  password: string,
): Promise<{ ok: false; error: string }> {
  if (!login.trim() || !password) {
    return { ok: false, error: "Podaj login i hasło." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      error:
        "Brak NEXT_PUBLIC_SUPABASE_URL lub klucza publishable na Vercel. Dodaj zmienne i zrób Redeploy.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: resolveAdminLogin(login),
    password,
  });

  if (error) {
    return { ok: false, error: polishAuthError(error.message) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sesja nie została utworzona. Spróbuj ponownie." };
  }

  const { data: row } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    await supabase.auth.signOut();
    return { ok: false, error: "Brak uprawnień." };
  }

  redirect("/admin");
}
