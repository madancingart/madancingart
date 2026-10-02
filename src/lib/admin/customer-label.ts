import { worstBillingStatus, type BillingStatus } from "@/lib/billing/status";
import type { CustomerKind } from "@/lib/types";

export type CustomerNameInput = {
  kind: CustomerKind | null;
  firstName: string;
  lastName: string | null;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  guardianName?: string | null;
};

export function customerDisplayName(input: CustomerNameInput): string {
  const primary = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  const isPair =
    input.kind === "pair" ||
    Boolean(input.partnerFirstName || input.partnerLastName);
  if (isPair) {
    const partner = [input.partnerFirstName, input.partnerLastName]
      .filter(Boolean)
      .join(" ");
    return partner ? `${primary} i ${partner}` : primary;
  }
  const isChild = input.kind === "child" || Boolean(input.guardianName);
  if (isChild && input.guardianName) {
    return `${primary} (opiekun: ${input.guardianName})`;
  }
  return primary;
}

export function customerFileHref(customerId: string): string {
  return `/admin/klienci/${customerId}`;
}

export function customerListBilling(input: {
  statuses: readonly BillingStatus[];
  weddingActive: boolean;
  weddingPending: boolean;
}): BillingStatus {
  if (input.statuses.length > 0) {
    return worstBillingStatus(input.statuses);
  }
  if (input.weddingPending) {
    return { tone: "amber", reason: "open", label: "Pakiet ślubny" };
  }
  if (input.weddingActive) {
    return { tone: "green", reason: "paid", label: "Pakiet ślubny" };
  }
  return { tone: "green", reason: "clear", label: "Bez zaległości" };
}
