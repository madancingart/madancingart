const FORBIDDEN = /[%*_(),]/g;

export const CUSTOMER_PAGE_SIZE = 30;

export function sanitizeCustomerQuery(raw: string): string {
  return raw.replaceAll(FORBIDDEN, "").trim().slice(0, 80);
}

export function digitsFromQuery(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 20);
}

const TEXT_COLUMNS = [
  "last_name",
  "first_name",
  "email",
  "phone",
  "partner_first_name",
  "partner_last_name",
  "guardian_name",
  "guardian_phone",
] as const;

/** PostgREST `or()` for name/email/partner/guardian + `phone_norm` digits. */
export function customerSearchOrFilter(raw: string): string | null {
  const cleaned = sanitizeCustomerQuery(raw);
  const digits = digitsFromQuery(raw);
  const filters: string[] = [];

  if (cleaned.length > 0) {
    const pattern = `%${cleaned}%`;
    for (const column of TEXT_COLUMNS) {
      filters.push(`${column}.ilike.${pattern}`);
    }
  }
  if (digits.length >= 3) {
    filters.push(`phone_norm.ilike.%${digits}%`);
  }

  if (filters.length === 0) {
    return null;
  }
  return filters.join(",");
}
