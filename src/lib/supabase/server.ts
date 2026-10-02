import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              path: "/",
              sameSite: "lax",
              secure:
                process.env.VERCEL === "1" ||
                process.env.NODE_ENV === "production",
            });
          });
        } catch {
          // Server Component cannot write cookies; middleware refreshes the session.
        }
      },
    },
  });
}

/** Odczyt publiczny bez ciastek — strony SSG (kursy) nie wchodzą w dynamiczne renderowanie. */
export function createPublicClient() {
  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
