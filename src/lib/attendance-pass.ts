import { formatDayMonth } from "@/lib/datetime";
import { isCoveringDate, remainingEntriesLabel } from "@/lib/billing/status";
import type { PackageKind, PackageStatus } from "@/lib/types";

export type ConsumablePass = {
  id: string;
  kind: PackageKind;
  status: PackageStatus;
  validFrom: string | null;
  validUntil: string | null;
  totalLessons: number | null;
  usedEntries: number;
};

function remainingOf(pkg: ConsumablePass): number {
  return (pkg.totalLessons ?? 0) - pkg.usedEntries;
}

function isActiveStatus(status: PackageStatus): boolean {
  return status === "active";
}

export function hasCoveringMonthly(
  packages: ConsumablePass[],
  sessionDateIso: string,
): boolean {
  return packages.some(
    (pkg) =>
      pkg.kind === "monthly" &&
      isActiveStatus(pkg.status) &&
      isCoveringDate(sessionDateIso, pkg.validFrom, pkg.validUntil),
  );
}

export function pickEntryPassToConsume(
  packages: ConsumablePass[],
  sessionDateIso: string,
): { id: string; remainingBefore: number } | null {
  const candidates = packages
    .filter((pkg) => {
      if (pkg.kind !== "pass_4" && pkg.kind !== "pass_8") {
        return false;
      }
      if (!isActiveStatus(pkg.status)) {
        return false;
      }
      if (!isCoveringDate(sessionDateIso, pkg.validFrom, pkg.validUntil)) {
        return false;
      }
      return remainingOf(pkg) > 0;
    })
    .sort((left, right) => {
      const remainingDiff = remainingOf(left) - remainingOf(right);
      if (remainingDiff !== 0) {
        return remainingDiff;
      }
      const untilLeft = left.validUntil ?? "9999-12-31";
      const untilRight = right.validUntil ?? "9999-12-31";
      return untilLeft.localeCompare(untilRight);
    });

  const picked = candidates[0];
  if (!picked) {
    return null;
  }
  return { id: picked.id, remainingBefore: remainingOf(picked) };
}

export function journalPassState(input: {
  present: boolean;
  packageId: string | null;
  packages: ConsumablePass[];
  sessionDateIso: string;
  coveredUntil?: string | null;
}): { unpaid: boolean; remainingLabel: string | null } {
  if (input.coveredUntil && input.coveredUntil >= input.sessionDateIso) {
    return {
      unpaid: false,
      remainingLabel: `opłacone do ${formatDayMonth(input.coveredUntil)}`,
    };
  }
  if (hasCoveringMonthly(input.packages, input.sessionDateIso)) {
    const monthly = input.packages.find(
      (pkg) =>
        pkg.kind === "monthly" &&
        isActiveStatus(pkg.status) &&
        isCoveringDate(input.sessionDateIso, pkg.validFrom, pkg.validUntil),
    );
    const until = monthly?.validUntil
      ? `do ${formatDayMonth(monthly.validUntil)}`
      : null;
    return {
      unpaid: false,
      remainingLabel: until
        ? `karnet miesięczny ${until}`
        : "karnet miesięczny",
    };
  }

  const consumed = input.packageId
    ? input.packages.find((pkg) => pkg.id === input.packageId)
    : null;
  if (
    consumed &&
    (consumed.kind === "pass_4" || consumed.kind === "pass_8")
  ) {
    return {
      unpaid: false,
      remainingLabel: remainingEntriesLabel(Math.max(0, remainingOf(consumed))),
    };
  }

  const picked = pickEntryPassToConsume(input.packages, input.sessionDateIso);
  if (picked) {
    return {
      unpaid: false,
      remainingLabel: remainingEntriesLabel(picked.remainingBefore),
    };
  }

  return {
    unpaid: input.present,
    remainingLabel: input.present ? "nieopłacone" : null,
  };
}
