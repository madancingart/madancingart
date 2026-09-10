import type {
  AdminBooking,
  AdminGroupMember,
  AdminMemberPackage,
} from "@/lib/admin/calendar-types";
import {
  isGroupPassKind,
  membershipSortRank,
  membershipStatus,
} from "@/lib/membership-status";
import type { PackageKind, PackagePaymentMethod, PackageStatus } from "@/lib/types";

export type GroupPackageRow = {
  id: string;
  customer_id: string;
  recurring_class_id: string | null;
  kind: PackageKind;
  label: string;
  status: PackageStatus;
  valid_from: string | null;
  valid_until: string | null;
  total_lessons: number | null;
  paid_at: string | null;
  payment_method: PackagePaymentMethod | null;
  price_cents: number;
};

function toMemberPackage(
  row: GroupPackageRow,
  usedEntries: number,
): AdminMemberPackage {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    status: row.status,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    totalLessons: row.total_lessons,
    usedEntries,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    priceCents: row.price_cents,
  };
}

function memberName(member: AdminGroupMember): string {
  return `${member.lastName ?? ""} ${member.firstName}`.trim().toLocaleLowerCase("pl");
}

export function buildGroupMembers(input: {
  bookings: AdminBooking[];
  packages: GroupPackageRow[];
  usedByPackageId: Map<string, number>;
  classId: string;
  todayIso: string;
}): AdminGroupMember[] {
  const active = input.bookings.filter((item) => item.status !== "cancelled");
  const groups = new Map<string, AdminBooking[]>();

  for (const booking of active) {
    const key = booking.customerId ?? booking.id;
    const list = groups.get(key) ?? [];
    list.push(booking);
    groups.set(key, list);
  }

  const members: AdminGroupMember[] = [];

  for (const [key, bookings] of groups) {
    const primary = bookings[0];
    if (!primary) {
      continue;
    }
    const customerId = primary.customerId;
    const classPackages = input.packages.filter((row) => {
      if (!isGroupPassKind(row.kind)) {
        return false;
      }
      if (row.recurring_class_id !== input.classId) {
        return false;
      }
      if (!customerId) {
        return false;
      }
      return row.customer_id === customerId;
    });
    const memberPackages = classPackages.map((row) =>
      toMemberPackage(row, input.usedByPackageId.get(row.id) ?? 0),
    );
    members.push({
      key,
      customerId,
      bookingIds: bookings.map((item) => item.id),
      firstName: primary.firstName,
      lastName: primary.lastName,
      phone: primary.phone,
      email: primary.email,
      customerKind: primary.customerKind,
      partnerFirstName: primary.partnerFirstName,
      partnerLastName: primary.partnerLastName,
      guardianName: primary.guardianName,
      guardianPhone: primary.guardianPhone,
      bookingStatus: bookings.some((item) => item.status === "pending")
        ? "pending"
        : "confirmed",
      membership: membershipStatus(
        memberPackages.map((pkg) => ({
          kind: pkg.kind,
          status: pkg.status,
          validFrom: pkg.validFrom,
          validUntil: pkg.validUntil,
          totalLessons: pkg.totalLessons,
          usedEntries: pkg.usedEntries,
        })),
        input.todayIso,
      ),
      packages: memberPackages,
    });
  }

  members.sort((a, b) => {
    const rank = membershipSortRank(a.membership.level) - membershipSortRank(b.membership.level);
    if (rank !== 0) {
      return rank;
    }
    return memberName(a).localeCompare(memberName(b), "pl");
  });

  return members;
}
