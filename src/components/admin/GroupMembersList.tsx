"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MembershipBadge } from "@/components/admin/MembershipBadge";
import { RecordPaymentForm } from "@/components/admin/RecordPaymentForm";
import type { AdminBooking, AdminGroupMember } from "@/lib/admin/calendar-types";
import { telHref } from "@/lib/contact";
import { formatDatePl } from "@/lib/datetime";
import { formatPlnFromCents } from "@/lib/money";
import type { LocationId } from "@/content/site";

type GroupMembersListProps = {
  classId: string;
  locationId: LocationId;
  classSlug: string;
  durationMin: number;
  members: AdminGroupMember[];
  bookings: AdminBooking[];
  pending: boolean;
  showFullLink?: boolean;
  onConfirm: (booking: AdminBooking) => void;
  onCancel: (booking: AdminBooking) => void;
  onPaymentDone: (message: string) => void;
  onPaymentError: (message: string) => void;
};

export function GroupMembersList({
  classId,
  locationId,
  classSlug,
  durationMin,
  members,
  bookings,
  pending,
  showFullLink = true,
  onConfirm,
  onCancel,
  onPaymentDone,
  onPaymentError,
}: GroupMembersListProps) {
  const [payKey, setPayKey] = useState<string | null>(null);
  const bookingById = new Map(bookings.map((item) => [item.id, item]));

  if (members.length === 0) {
    return <p className="text-[13px] text-muted">Brak zapisanych osób.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {showFullLink ? (
        <Link
          href={`/admin/grupy/${classId}`}
          className="text-[13px] text-gold hover:text-gold-light"
        >
          Pełna lista grupy
        </Link>
      ) : null}
      <ul className="flex flex-col gap-3">
        {members.map((member) => {
          const primary = bookingById.get(member.bookingIds[0] ?? "");
          return (
            <li
              key={member.key}
              className="border border-white/10 bg-black-soft p-3"
            >
              <MemberIdentity member={member} />
              <div className="mt-2">
                <MembershipBadge status={member.membership} />
              </div>
              {member.packages.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1 text-[12px] text-muted">
                  {member.packages.map((pkg) => (
                    <li key={pkg.id}>
                      {pkg.label}
                      {pkg.validUntil
                        ? ` · do ${formatDatePl(pkg.validUntil)}`
                        : ""}
                      {pkg.totalLessons != null
                        ? ` · ${pkg.usedEntries}/${pkg.totalLessons}`
                        : ""}
                      {` · ${formatPlnFromCents(pkg.priceCents)}`}
                    </li>
                  ))}
                </ul>
              ) : null}
              {primary && member.bookingStatus !== "cancelled" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {member.bookingStatus === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => onConfirm(primary)}
                    >
                      Potwierdź
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onCancel(primary)}
                  >
                    Anuluj
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      setPayKey((current) =>
                        current === member.key ? null : member.key,
                      )
                    }
                  >
                    Odnotuj wpłatę
                  </Button>
                </div>
              ) : null}
              {payKey === member.key && primary ? (
                <RecordPaymentForm
                  classId={classId}
                  bookingId={primary.id}
                  locationId={locationId}
                  classSlug={classSlug}
                  durationMin={durationMin}
                  disabled={pending}
                  onDone={(message) => {
                    setPayKey(null);
                    onPaymentDone(message);
                  }}
                  onError={onPaymentError}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MemberIdentity({ member }: { member: AdminGroupMember }) {
  const firstLabel = [member.firstName, member.lastName]
    .filter(Boolean)
    .join(" ");
  const partnerLabel = [member.partnerFirstName, member.partnerLastName]
    .filter(Boolean)
    .join(" ");
  const isPair =
    member.customerKind === "pair" || Boolean(partnerLabel);
  const isChild =
    member.customerKind === "child" || Boolean(member.guardianName);
  const phone = isChild
    ? (member.guardianPhone ?? member.phone)
    : member.phone;

  return (
    <div>
      {isPair ? (
        <>
          <p className="text-[12px] text-muted">Pierwsza osoba</p>
          <p className="text-cream">{firstLabel}</p>
          <p className="mt-1 text-[12px] text-muted">Druga osoba</p>
          <p className="text-cream">{partnerLabel || "—"}</p>
        </>
      ) : isChild ? (
        <>
          <p className="text-[12px] text-muted">Dziecko</p>
          <p className="text-cream">{firstLabel}</p>
          <p className="mt-1 text-[12px] text-muted">Rodzic / opiekun</p>
          <p className="text-cream">{member.guardianName || "—"}</p>
        </>
      ) : (
        <p className="text-cream">{firstLabel}</p>
      )}
      <p className="mt-1 text-[13px]">
        {phone ? (
          <a href={telHref(phone)} className="text-gold hover:text-gold-light">
            {phone}
          </a>
        ) : (
          <span className="text-muted">brak telefonu</span>
        )}
        {" · "}
        {member.email ? (
          <a
            href={`mailto:${member.email}`}
            className="text-gold hover:text-gold-light"
          >
            {member.email}
          </a>
        ) : (
          <span className="text-muted">brak e-maila</span>
        )}
      </p>
    </div>
  );
}
