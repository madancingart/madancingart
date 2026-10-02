import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { participantLine } from "@/lib/billing/notices";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunk } from "@/lib/jobs/chunk";

export type Recipient = {
  email: string | null;
  greetingName: string;
  participantLine: string | null;
  phone: string;
  displayName: string;
};

type CustomerRow = {
  id: string;
  kind: string;
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  phone: string | null;
  email: string | null;
  owner_user_id: string | null;
};

function firstWord(value: string | null): string | null {
  const word = value?.trim().split(/\s+/)[0];
  return word || null;
}

function displayName(row: CustomerRow): string {
  const self = `${row.first_name} ${row.last_name}`.trim();
  if (row.kind === "pair" && row.partner_first_name) {
    return `${self} i ${row.partner_first_name} ${row.partner_last_name ?? ""}`
      .replace(/\s+/g, " ")
      .trim();
  }
  return self;
}

export async function loadRecipients(
  customerIds: string[],
): Promise<Map<string, Recipient>> {
  const ids = [...new Set(customerIds)];
  const result = new Map<string, Recipient>();
  if (ids.length === 0) {
    return result;
  }
  const admin = createAdminClient();
  const customers: CustomerRow[] = [];
  for (const slice of chunk(ids, 100)) {
    const { data, error } = await admin
      .from("customers")
      .select(
        "id, kind, first_name, last_name, partner_first_name, partner_last_name, guardian_name, guardian_phone, phone, email, owner_user_id",
      )
      .in("id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać uczestników.");
    }
    customers.push(...((data ?? []) as CustomerRow[]));
  }

  const ownerIds = [
    ...new Set(
      customers
        .map((row) => row.owner_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const profileNames = new Map<string, string>();
  for (const slice of chunk(ownerIds, 100)) {
    const { data, error } = await admin
      .from("account_profiles")
      .select("user_id, first_name")
      .in("user_id", slice);
    if (error) {
      throw new Error("Nie udało się wczytać profili.");
    }
    for (const row of (data ?? []) as { user_id: string; first_name: string }[]) {
      profileNames.set(row.user_id, row.first_name);
    }
  }
  const authEmails = await ownerEmails(admin, ownerIds);

  for (const row of customers) {
    const ownerId = row.owner_user_id;
    const ownerName = ownerId ? profileNames.get(ownerId) : null;
    const greetingName =
      ownerName ||
      (row.kind === "child"
        ? firstWord(row.guardian_name) || row.first_name
        : row.first_name);
    const authEmail = ownerId ? authEmails.get(ownerId) : null;
    const email = (authEmail || row.email || "").trim() || null;
    const phone =
      row.kind === "child" ? row.guardian_phone || row.phone || "" : row.phone || "";
    result.set(row.id, {
      email,
      greetingName,
      participantLine:
        row.kind === "child"
          ? participantLine(`${row.first_name} ${row.last_name}`.trim())
          : null,
      phone,
      displayName: displayName(row),
    });
  }
  return result;
}

async function ownerEmails(
  admin: SupabaseClient,
  ownerIds: string[],
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  let next = 0;
  async function worker() {
    while (next < ownerIds.length) {
      const index = next;
      next += 1;
      const userId = ownerIds[index];
      if (!userId) {
        continue;
      }
      const { data } = await admin.auth.admin.getUserById(userId);
      const email = data.user?.email?.trim();
      if (email) {
        emails.set(userId, email);
      }
    }
  }
  const workers = Math.min(8, ownerIds.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return emails;
}
