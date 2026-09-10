import { isWeddingPackageKind } from "@/content/packages";
import {
  membershipStatus,
  type MembershipPackageInput,
  type MembershipStatus,
} from "@/lib/membership-status";
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

export function customerListPaymentStatus(
  packages: MembershipPackageInput[],
  todayIso: string,
): MembershipStatus {
  const group = membershipStatus(packages, todayIso);
  if (group.level !== "unpaid") {
    return group;
  }
  const wedding = packages.filter((pkg) => isWeddingPackageKind(pkg.kind));
  if (wedding.some((pkg) => pkg.status === "active")) {
    return { level: "ok", label: "opłacone", detail: "pakiet ślubny" };
  }
  if (wedding.some((pkg) => pkg.status === "pending_payment")) {
    return { level: "unpaid", label: "nieopłacone", detail: "oczekuje na płatność" };
  }
  return group;
}
