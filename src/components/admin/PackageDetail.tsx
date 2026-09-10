"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScheduleLessonModal } from "@/components/admin/ScheduleLessonModal";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import { Button } from "@/components/ui/Button";
import { telHref } from "@/lib/contact";
import { formatDatePl, formatDateTimeWarsaw } from "@/lib/datetime";
import { formatPlnFromCents } from "@/lib/money";
import { weddingCoupleTileLabel } from "@/lib/packages/couple-label";
import { trainerShortName, UNASSIGNED_TRAINER_LABEL } from "@/lib/trainers";
import type { PackagePaymentMethod, PackageStatus } from "@/lib/types";
import {
  markPackagePaid,
} from "@/app/admin/(app)/pakiety/actions";
import type { AdminTrainer } from "@/lib/admin/calendar-types";

export type PackageLessonRow = {
  id: string;
  lessonNo: number | null;
  status: string;
  startsAt: string | null;
  locationLabel: string | null;
  trainerId: string | null;
};

export type PackageDetailData = {
  id: string;
  label: string;
  kind: string;
  status: PackageStatus;
  paymentMethod: PackagePaymentMethod | null;
  priceCents: number;
  totalLessons: number | null;
  usedLessons: number;
  weddingDate: string | null;
  songs: string[];
  validFrom: string | null;
  paidAt: string | null;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string;
    partnerFirstName: string | null;
    partnerLastName: string | null;
    phone: string | null;
    email: string | null;
  };
  lessons: PackageLessonRow[];
  trainers: AdminTrainer[];
};

export function PackageDetail(props: { data: PackageDetailData }) {
  return (
    <ToastProvider>
      <PackageDetailInner data={props.data} />
    </ToastProvider>
  );
}

function PackageDetailInner({ data }: { data: PackageDetailData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const couple = weddingCoupleTileLabel({
    lastName: data.customer.lastName,
    partnerLastName: data.customer.partnerLastName,
  });
  const canSchedule = data.status === "active";
  const canMarkPaid = data.status === "pending_payment";
  const progress =
    data.totalLessons != null
      ? `${data.usedLessons}/${data.totalLessons}`
      : `${data.usedLessons}`;

  async function markPaid(paymentMethod: "onsite" | "transfer") {
    setPending(true);
    const result = await markPackagePaid({
      packageId: data.id,
      paymentMethod,
    });
    setPending(false);
    if (result.ok) {
      toast.push("ok", result.message ?? "Zapisane.");
      router.refresh();
    } else {
      toast.push("err", result.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[12px] text-muted">{data.label}</p>
        <h1 className="text-2xl font-semibold text-cream">{couple}</h1>
        <p className="mt-1 text-[14px] text-muted">
          {data.customer.firstName} {data.customer.lastName}
          {data.customer.partnerFirstName
            ? ` i ${data.customer.partnerFirstName} ${data.customer.partnerLastName ?? ""}`
            : ""}
        </p>
      </div>

      <dl className="grid gap-2 text-[14px] text-muted sm:grid-cols-2">
        <div>
          Status: <span className="text-cream">{data.status}</span>
        </div>
        <div>
          Postęp: <span className="text-cream">{progress}</span>
        </div>
        <div>
          Wesele:{" "}
          <span className="text-cream">
            {data.weddingDate ? formatDatePl(data.weddingDate) : "—"}
          </span>
        </div>
        <div>
          Kwota:{" "}
          <span className="text-cream">
            {formatPlnFromCents(data.priceCents)}
          </span>
        </div>
        <div>
          Telefon:{" "}
          {data.customer.phone ? (
            <a
              href={telHref(data.customer.phone)}
              className="text-gold hover:text-gold-light"
            >
              {data.customer.phone}
            </a>
          ) : (
            "—"
          )}
        </div>
        <div>
          E-mail:{" "}
          {data.customer.email ? (
            <a
              href={`mailto:${data.customer.email}`}
              className="text-gold hover:text-gold-light"
            >
              {data.customer.email}
            </a>
          ) : (
            "—"
          )}
        </div>
      </dl>

      <div>
        <h2 className="text-[15px] font-semibold text-cream">Piosenki</h2>
        {data.songs.length === 0 ? (
          <p className="mt-1 text-[14px] text-muted">Brak propozycji.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-[14px] text-cream">
            {data.songs.map((song) => (
              <li key={song}>{song}</li>
            ))}
          </ul>
        )}
      </div>

      {canMarkPaid ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => void markPaid("onsite")}
          >
            Oznacz jako opłacony (na miejscu)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void markPaid("transfer")}
          >
            Oznacz jako opłacony (przelew)
          </Button>
        </div>
      ) : null}

      {canSchedule ? (
        <div>
          <Button
            type="button"
            size="sm"
            onClick={() => setScheduleOpen(true)}
          >
            Zaplanuj lekcję
          </Button>
        </div>
      ) : null}

      <div>
        <h2 className="text-[15px] font-semibold text-cream">Lekcje</h2>
        {data.lessons.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">
            Brak zaplanowanych lekcji — pula czeka na terminy.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="border border-white/10 px-3 py-2 text-[13px]"
              >
                <span className="text-cream">
                  {lesson.lessonNo != null ? `${lesson.lessonNo}. ` : ""}
                  {lesson.startsAt
                    ? formatDateTimeWarsaw(lesson.startsAt)
                    : "bez terminu"}
                </span>
                <span className="text-muted">
                  {" · "}
                  {lesson.locationLabel ?? "—"}
                  {" · "}
                  {trainerShortName(lesson.trainerId) ??
                    UNASSIGNED_TRAINER_LABEL}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {scheduleOpen ? (
        <ScheduleLessonModal
          packageId={data.id}
          trainers={data.trainers}
          onClose={() => setScheduleOpen(false)}
          onDone={(message) => {
            toast.push("ok", message);
            setScheduleOpen(false);
            router.refresh();
          }}
          onError={(message) => toast.push("err", message)}
        />
      ) : null}
    </div>
  );
}
