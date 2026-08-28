import { createBrowserClient } from "@supabase/ssr";

/**
 * Next.js wstrzykuje NEXT_PUBLIC_* tylko przy literalnym process.env.NAZWA.
 * Nie używaj getSupabaseUrl() tutaj — dynamiczny odczyt env nie trafia do bundla klienta.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Brak NEXT_PUBLIC_SUPABASE_URL lub klucza publishable/anon. Ustaw zmienne na Vercel i zrób redeploy.",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
