const FALLBACK = "/konto";

function isRelativePath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !value.includes("\\") &&
    !/[\u0000\n\r]/.test(value)
  );
}

/** Ścieżka względna albo ten sam host. Inaczej adres domyślny. */
export function safeNextPath(
  value: string | null | undefined,
  fallback = FALLBACK,
  allowedOrigins: readonly string[] = [],
): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (isRelativePath(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (allowedOrigins.includes(url.origin) && isRelativePath(url.pathname)) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function pathAfterLogin(
  result: { claimed: number; needsProfile: boolean },
  next: string,
): string {
  const destination = withClaimed(next, result.claimed);
  if (result.needsProfile) {
    return `/konto/uzupelnij?next=${encodeURIComponent(destination)}`;
  }
  return destination;
}

function withClaimed(next: string, claimed: number): string {
  if (claimed <= 0) {
    return next;
  }

  const url = new URL(next, "http://local");
  if (url.pathname !== "/konto/witaj") {
    return next;
  }

  url.searchParams.set("claimed", String(claimed));
  return `${url.pathname}${url.search}`;
}

export function newClassSignupPath(classId: string): string {
  return `/konto/zapisy/nowy?grupa=${encodeURIComponent(classId)}`;
}

/** Zalogowany idzie od razu na zapis. Gość zakłada konto i wraca w to samo miejsce. */
export function classSignupHref(classId: string, signedIn: boolean): string {
  const next = newClassSignupPath(classId);
  if (signedIn) {
    return next;
  }
  return `/konto/rejestracja?next=${encodeURIComponent(next)}`;
}

export function groupSignupHref(classId: string): string {
  return newClassSignupPath(classId);
}

/** Wejście w checkout należności (podłączenie płatności — kolejny krok). */
export function payChargeHref(chargeId: string): string {
  return `/konto/oplac?naleznosc=${encodeURIComponent(chargeId)}`;
}
