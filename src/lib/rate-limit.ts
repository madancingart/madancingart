const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;

const hitsByIp = new Map<string, number[]>();

export function clientIpFromHeaders(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return headerList.get("x-real-ip")?.trim() || "unknown";
}

export function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}

/** Returns true when the request is allowed. */
export function allowBookingAttempt(ip: string, now = Date.now()): boolean {
  const recent = (hitsByIp.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );
  if (recent.length >= MAX_HITS) {
    hitsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  hitsByIp.set(ip, recent);
  return true;
}

const PAY_WINDOW_MS = 10 * 60 * 1000;
const PAY_MAX_HITS = 30;
const payHitsByIp = new Map<string, number[]>();

/** Odczyt linku /zaplac — osobny licznik, żeby nie blokował zapisów. */
export function allowPayTokenLookup(ip: string, now = Date.now()): boolean {
  const recent = (payHitsByIp.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < PAY_WINDOW_MS,
  );
  if (recent.length >= PAY_MAX_HITS) {
    payHitsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  payHitsByIp.set(ip, recent);
  return true;
}
