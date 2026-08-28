export const ADMIN_LOGIN_EMAIL = "admin@madancingart.pl";

/** Login „admin” mapuje na konto panelu. */
export function resolveAdminLogin(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "admin") {
    return ADMIN_LOGIN_EMAIL;
  }
  return trimmed;
}
