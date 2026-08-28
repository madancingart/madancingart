export const ADMIN_LOGIN_EMAIL = "admin@madancingart.pl";

/** Login „admin” mapuje na konto panelu. */
export function resolveAdminLogin(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "admin") {
    return ADMIN_LOGIN_EMAIL;
  }
  return trimmed;
}

export function polishAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid_credentials")) {
    return "Nieprawidłowy e-mail lub hasło.";
  }
  if (lower.includes("email not confirmed")) {
    return "Potwierdź adres e-mail, zanim się zalogujesz.";
  }
  if (lower.includes("too many")) {
    return "Zbyt wiele prób. Spróbuj za chwilę.";
  }
  return "Nie udało się zalogować. Spróbuj ponownie.";
}
