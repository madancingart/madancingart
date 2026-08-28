function requireEnv(name: string, fallback?: string): string {
  const value = (process.env[name] ?? fallback)?.trim();
  if (!value) {
    throw new Error(`Brak zmiennej środowiskowej ${name}`);
  }
  return value;
}

/** Sprawdza env bez rzucania — używane w middleware (Edge), żeby nie wywalać całej strony. */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return requireEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}
