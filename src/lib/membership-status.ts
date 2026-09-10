import { formatDayMonth, isoDateDiffDays } from "@/lib/datetime";
import type { PackageKind, PackageStatus } from "@/lib/types";

export const GROUP_PASS_KINDS = ["monthly", "pass_4", "pass_8"] as const;

export type GroupPassKind = (typeof GROUP_PASS_KINDS)[number];

export type MembershipLevel = "ok" | "ending" | "unpaid";

export type MembershipPackageInput = {
  kind: PackageKind;
  status: PackageStatus;
  validFrom: string | null;
  validUntil: string | null;
  totalLessons: number | null;
  usedEntries: number;
};

export type MembershipStatus = {
  level: MembershipLevel;
  label: string;
  detail: string | null;
};

const ENDING_DAYS = 7;

export function isGroupPassKind(kind: string): kind is GroupPassKind {
  return GROUP_PASS_KINDS.includes(kind as GroupPassKind);
}

export function remainingEntriesLabel(count: number): string {
  if (count === 1) {
    return "zostało 1 wejście";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `zostały ${count} wejścia`;
  }
  return `zostało ${count} wejść`;
}

function untilDetail(validUntil: string | null): string | null {
  if (!validUntil) {
    return null;
  }
  return `do ${formatDayMonth(validUntil)}`;
}

export function isCoveringDate(
  todayIso: string,
  validFrom: string | null,
  validUntil: string | null,
): boolean {
  if (validFrom && todayIso < validFrom) {
    return false;
  }
  if (validUntil && todayIso > validUntil) {
    return false;
  }
  return true;
}

type Candidate = {
  level: Exclude<MembershipLevel, "unpaid">;
  detail: string | null;
  rank: number;
};

function monthlyCandidate(
  pkg: MembershipPackageInput,
  todayIso: string,
): Candidate | null {
  if (!isCoveringDate(todayIso, pkg.validFrom, pkg.validUntil)) {
    return null;
  }
  const detail = untilDetail(pkg.validUntil);
  if (pkg.validUntil) {
    const daysLeft = isoDateDiffDays(todayIso, pkg.validUntil);
    if (daysLeft <= ENDING_DAYS) {
      return { level: "ending", detail, rank: 1 };
    }
  }
  return { level: "ok", detail, rank: 2 };
}

function passCandidate(
  pkg: MembershipPackageInput,
  todayIso: string,
): Candidate | null {
  if (pkg.validUntil && todayIso > pkg.validUntil) {
    return null;
  }
  if (pkg.validFrom && todayIso < pkg.validFrom) {
    return null;
  }
  const total = pkg.totalLessons ?? 0;
  const remaining = total - pkg.usedEntries;
  if (remaining <= 0) {
    return null;
  }
  if (remaining === 1) {
    return {
      level: "ending",
      detail: remainingEntriesLabel(1),
      rank: 1,
    };
  }
  return {
    level: "ok",
    detail: remainingEntriesLabel(remaining),
    rank: 2,
  };
}

function candidateFor(
  pkg: MembershipPackageInput,
  todayIso: string,
): Candidate | null {
  if (!isGroupPassKind(pkg.kind)) {
    return null;
  }
  if (pkg.status === "cancelled" || pkg.status === "pending_payment") {
    return null;
  }
  if (pkg.kind === "monthly") {
    return monthlyCandidate(pkg, todayIso);
  }
  return passCandidate(pkg, todayIso);
}

export function membershipStatus(
  packages: MembershipPackageInput[],
  todayIso: string,
): MembershipStatus {
  const candidates = packages
    .map((pkg) => candidateFor(pkg, todayIso))
    .filter((item): item is Candidate => item !== null);

  const best = candidates.reduce<Candidate | null>((current, next) => {
    if (!current || next.rank > current.rank) {
      return next;
    }
    return current;
  }, null);

  if (!best) {
    return { level: "unpaid", label: "nieopłacone", detail: null };
  }
  if (best.level === "ok") {
    return { level: "ok", label: "opłacone", detail: best.detail };
  }
  return { level: "ending", label: "kończy się", detail: best.detail };
}

export function membershipSortRank(level: MembershipLevel): number {
  if (level === "unpaid") {
    return 0;
  }
  if (level === "ending") {
    return 1;
  }
  return 2;
}
