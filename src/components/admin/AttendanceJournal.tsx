"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { toggleAttendance } from "@/app/admin/(app)/ewidencja/actions";
import { CancelClassOccurrenceForm } from "@/components/admin/CancelClassOccurrenceForm";
import { DropInPanel } from "@/components/admin/DropInPanel";
import { CustomerNameLink } from "@/components/admin/CustomerNameLink";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import { cn } from "@/lib/cn";
import { clockFromDbTime, formatDatePl, weekdayLongLabel } from "@/lib/datetime";
import type { JournalData, JournalPerson } from "@/lib/admin/journal-types";

export function AttendanceJournal({ data }: { data: JournalData }) {
  return (
    <ToastProvider>
      <AttendanceJournalInner data={data} />
    </ToastProvider>
  );
}

function personLabel(person: JournalPerson): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
  if (person.partnerFirstName || person.partnerLastName) {
    const partner = [person.partnerFirstName, person.partnerLastName]
      .filter(Boolean)
      .join(" ");
    return partner ? `${name} / ${partner}` : name;
  }
  if (person.guardianName) {
    return `${name} (op. ${person.guardianName})`;
  }
  return name;
}

type PersonOverlay = {
  present: boolean;
  unpaid: boolean;
  remainingLabel: string | null;
  customerId: string | null;
};

function AttendanceJournalInner({ data }: { data: JournalData }) {
  const router = useRouter();
  const toast = useToast();
  const cancelled = data.sessionStatus === "cancelled";
  const [overlays, setOverlays] = useState<Record<string, PersonOverlay>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const people = data.people.map((person) => {
    const overlay =
      overlays[person.key] ??
      (person.customerId ? overlays[person.customerId] : undefined);
    if (!overlay) {
      return person;
    }
    return {
      ...person,
      key: overlay.customerId ?? person.key,
      customerId: overlay.customerId ?? person.customerId,
      present: overlay.present,
      unpaid: overlay.unpaid,
      remainingLabel: overlay.remainingLabel,
    };
  });

  async function onToggle(person: JournalPerson) {
    if (cancelled) {
      return;
    }
    const nextPresent = !person.present;
    const optimistic: PersonOverlay = {
      present: nextPresent,
      unpaid: person.unpaid,
      remainingLabel: person.remainingLabel,
      customerId: person.customerId,
    };
    setOverlays((current) => ({ ...current, [person.key]: optimistic }));
    setPendingKey(person.key);
    const result = await toggleAttendance({
      sessionId: data.sessionId,
      classId: data.classId,
      sessionDate: data.sessionDate,
      present: nextPresent,
      customerId: person.customerId ?? undefined,
      bookingId: person.bookingId ?? undefined,
    });
    setPendingKey(null);
    if (!result.ok) {
      setOverlays((current) => {
        const next = { ...current };
        delete next[person.key];
        return next;
      });
      toast.push("err", result.error);
      return;
    }
    const confirmed: PersonOverlay = {
      present: result.present,
      unpaid: result.unpaid,
      remainingLabel: result.remainingLabel,
      customerId: result.customerId,
    };
    setOverlays((current) => ({
      ...current,
      [person.key]: confirmed,
      [result.customerId]: confirmed,
    }));
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div>
        <p className="text-[12px] text-muted">{data.locationCity}</p>
        <h2 className="text-xl font-semibold text-cream">{data.className}</h2>
        <p className="mt-1 text-[14px] text-muted">
          {formatDatePl(data.sessionDate)}
          {` · ${weekdayLongLabel(data.weekday)} ${clockFromDbTime(data.startTime)}`}
          {data.level ? ` · ${data.level}` : ""}
        </p>
      </div>

      {cancelled ? (
        <p className="border border-white/10 bg-white/5 px-3 py-3 text-[13px] text-muted">
          Odwołane
          {data.cancelReason ? ` — ${data.cancelReason}` : ""}
        </p>
      ) : (
        <CancelClassOccurrenceForm
          classId={data.classId}
          sessionDate={data.sessionDate}
          onDone={(message) => {
            toast.push("ok", message);
            router.refresh();
          }}
          onError={(message) => toast.push("err", message)}
        />
      )}

      <ul className="flex flex-col gap-2">
        {people.length === 0 ? (
          <li className="text-[13px] text-muted">
            Brak osób na liście. Możesz dopisać gościa poniżej.
          </li>
        ) : (
          people.map((person) => {
            const label = personLabel(person);
            return (
              <li
                key={person.key}
                className={cn(
                  "flex items-center gap-3 border px-3 py-2",
                  person.present && person.unpaid
                    ? "border-[#E8A0A0]/50 bg-[#E8A0A0]/10"
                    : "border-white/10 bg-black-soft",
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={person.present}
                  aria-label={`Obecność: ${label}`}
                  disabled={cancelled || pendingKey === person.key}
                  onClick={() => void onToggle(person)}
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center border",
                    person.present
                      ? "border-gold bg-gold/20 text-gold"
                      : "border-white/20 text-transparent",
                    cancelled ? "opacity-40" : "",
                  )}
                >
                  <Check strokeWidth={1.5} className="size-7" aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-cream">
                    <CustomerNameLink customerId={person.customerId}>
                      {label}
                    </CustomerNameLink>
                    {person.dropIn ? (
                      <span className="ml-2 text-[12px] text-muted">gość</span>
                    ) : null}
                  </p>
                  {person.remainingLabel ? (
                    <p
                      className={cn(
                        "text-[12px]",
                        person.unpaid ? "text-[#E8A0A0]" : "text-muted",
                      )}
                    >
                      {person.remainingLabel}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>

      {cancelled ? null : (
        <DropInPanel
          sessionId={data.sessionId}
          classId={data.classId}
          sessionDate={data.sessionDate}
          excludeIds={people
            .map((item) => item.customerId)
            .filter((id): id is string => Boolean(id))}
          onAdded={() => router.refresh()}
        />
      )}
    </div>
  );
}
