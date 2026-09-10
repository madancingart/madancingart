"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { RecordPaymentForm } from "@/components/admin/RecordPaymentForm";
import { ScheduleLessonModal } from "@/components/admin/ScheduleLessonModal";
import { useToast } from "@/components/admin/Toast";
import { formatDatePl } from "@/lib/datetime";
import { formatPlnFromCents } from "@/lib/money";
import { markPackagePaid } from "@/app/admin/(app)/pakiety/actions";
import type {
  CustomerClassEnrollment,
  CustomerPackageCard,
} from "@/lib/admin/get-customer";
import type { AdminTrainer } from "@/lib/admin/calendar-types";
import type { PackageStatus } from "@/lib/types";

function statusLabel(status: PackageStatus): string {
  if (status === "pending_payment") {
    return "do opłacenia";
  }
  if (status === "active") {
    return "aktywny";
  }
  if (status === "completed") {
    return "wyczerpany";
  }
  if (status === "expired") {
    return "wygasł";
  }
  return "anulowany";
}

function progressLabel(pkg: CustomerPackageCard): string {
  const parts: string[] = [];
  if (pkg.totalLessons != null) {
    parts.push(`${pkg.usedEntries}/${pkg.totalLessons}`);
  } else if (pkg.isGroup) {
    parts.push(`${pkg.usedEntries} wejść`);
  }
  if (pkg.validFrom || pkg.validUntil) {
    const from = pkg.validFrom ? formatDatePl(pkg.validFrom) : "—";
    const until = pkg.validUntil ? formatDatePl(pkg.validUntil) : "—";
    parts.push(`ważność ${from} – ${until}`);
  }
  return parts.join(" · ");
}

function isActiveStatus(status: PackageStatus): boolean {
  return status === "active" || status === "pending_payment";
}

export function CustomerPackagesSection({
  packages,
  enrollments,
  trainers,
}: {
  packages: CustomerPackageCard[];
  enrollments: CustomerClassEnrollment[];
  trainers: AdminTrainer[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [payKey, setPayKey] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const active = packages.filter((pkg) => isActiveStatus(pkg.status));
  const historical = packages.filter((pkg) => !isActiveStatus(pkg.status));
  const paymentTargets = enrollments.filter(
    (item) =>
      !packages.some(
        (pkg) => pkg.isGroup && pkg.bookingId === item.bookingId && isActiveStatus(pkg.status),
      ),
  );

  async function markPaid(packageId: string, paymentMethod: "onsite" | "transfer") {
    setPending(true);
    const result = await markPackagePaid({ packageId, paymentMethod });
    setPending(false);
    if (result.ok) {
      toast.push("ok", result.message ?? "Wpłata odnotowana.");
      router.refresh();
    } else {
      toast.push("err", result.error);
    }
  }

  return (
    <section className="border border-white/10 bg-black-soft p-4">
      <h2 className="text-[15px] font-semibold text-cream">Pakiety i płatności</h2>
      {packages.length === 0 && enrollments.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">Brak pakietów.</p>
      ) : null}

      {active.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[13px] text-muted">Aktywne</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {active.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                payOpen={payKey === pkg.id}
                pending={pending}
                onTogglePay={() =>
                  setPayKey((current) => (current === pkg.id ? null : pkg.id))
                }
                onSchedule={() => setScheduleId(pkg.id)}
                onMarkPaid={markPaid}
                onPaymentDone={(message) => {
                  setPayKey(null);
                  toast.push("ok", message);
                  router.refresh();
                }}
                onPaymentError={(message) => toast.push("err", message)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {historical.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-[13px] text-muted">Historyczne</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {historical.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                payOpen={false}
                pending={pending}
                onTogglePay={() => undefined}
                onSchedule={() => undefined}
                onMarkPaid={() => undefined}
                onPaymentDone={() => undefined}
                onPaymentError={() => undefined}
                readOnly
              />
            ))}
          </ul>
        </div>
      ) : null}

      {paymentTargets.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-[13px] text-muted">Grupy bez aktywnego karnetu</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {paymentTargets.map((item) => (
              <li key={item.bookingId} className="border border-white/10 p-3">
                <p className="text-cream">{item.className}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() =>
                    setPayKey((current) =>
                      current === item.bookingId ? null : item.bookingId,
                    )
                  }
                >
                  Odnotuj wpłatę
                </Button>
                {payKey === item.bookingId ? (
                  <RecordPaymentForm
                    classId={item.classId}
                    bookingId={item.bookingId}
                    locationId={item.locationId}
                    classSlug={item.classSlug}
                    durationMin={item.durationMin}
                    onDone={(message) => {
                      setPayKey(null);
                      toast.push("ok", message);
                      router.refresh();
                    }}
                    onError={(message) => toast.push("err", message)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scheduleId ? (
        <ScheduleLessonModal
          packageId={scheduleId}
          trainers={trainers}
          onClose={() => setScheduleId(null)}
          onDone={(message) => {
            setScheduleId(null);
            toast.push("ok", message);
            router.refresh();
          }}
          onError={(message) => toast.push("err", message)}
        />
      ) : null}
    </section>
  );
}

function PackageCard({
  pkg,
  payOpen,
  pending,
  readOnly = false,
  onTogglePay,
  onSchedule,
  onMarkPaid,
  onPaymentDone,
  onPaymentError,
}: {
  pkg: CustomerPackageCard;
  payOpen: boolean;
  pending: boolean;
  readOnly?: boolean;
  onTogglePay: () => void;
  onSchedule: () => void;
  onMarkPaid: (packageId: string, method: "onsite" | "transfer") => void;
  onPaymentDone: (message: string) => void;
  onPaymentError: (message: string) => void;
}) {
  const canRecordGroup =
    pkg.isGroup &&
    pkg.bookingId &&
    pkg.classId &&
    pkg.locationId &&
    pkg.classSlug &&
    !readOnly;
  const canSchedule = pkg.isWedding && pkg.status === "active" && !readOnly;
  const canMarkWedding = pkg.isWedding && pkg.status === "pending_payment" && !readOnly;

  return (
    <li className="border border-white/10 p-3">
      <p className="text-[14px] font-semibold text-cream">{pkg.label}</p>
      <p className="mt-1 text-[13px] text-muted">
        {statusLabel(pkg.status)}
        {pkg.className ? ` · ${pkg.className}` : ""}
      </p>
      <p className="mt-1 text-[13px] text-cream">{progressLabel(pkg)}</p>
      <p className="mt-1 text-[13px] text-muted">
        {formatPlnFromCents(pkg.priceCents)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {pkg.isWedding ? (
          <Link
            href={`/admin/pakiety/${pkg.id}`}
            className="min-h-11 text-[13px] text-gold hover:text-gold-light"
          >
            Szczegóły pakietu
          </Link>
        ) : null}
        {pkg.classId ? (
          <Link
            href={`/admin/grupy/${pkg.classId}`}
            className="min-h-11 text-[13px] text-gold hover:text-gold-light"
          >
            Grupa
          </Link>
        ) : null}
      </div>
      {!readOnly ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canRecordGroup ? (
            <Button type="button" size="sm" variant="ghost" onClick={onTogglePay}>
              Odnotuj wpłatę
            </Button>
          ) : null}
          {canMarkWedding ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => onMarkPaid(pkg.id, "onsite")}
              >
                Odnotuj wpłatę (gotówka)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onMarkPaid(pkg.id, "transfer")}
              >
                Odnotuj wpłatę (przelew)
              </Button>
            </>
          ) : null}
          {canSchedule ? (
            <Button type="button" size="sm" onClick={onSchedule}>
              Zaplanuj lekcję
            </Button>
          ) : null}
        </div>
      ) : null}
      {payOpen && canRecordGroup && pkg.bookingId && pkg.classId && pkg.locationId ? (
        <RecordPaymentForm
          classId={pkg.classId}
          bookingId={pkg.bookingId}
          locationId={pkg.locationId}
          classSlug={pkg.classSlug ?? ""}
          durationMin={pkg.durationMin ?? 60}
          onDone={onPaymentDone}
          onError={onPaymentError}
        />
      ) : null}
    </li>
  );
}
