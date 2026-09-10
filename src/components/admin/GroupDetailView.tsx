"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GroupMembersList } from "@/components/admin/GroupMembersList";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import type { AdminGroupDetail } from "@/lib/admin/calendar-types";
import { site } from "@/content/site";
import {
  cancelBooking,
  confirmBooking,
} from "@/app/admin/(app)/kalendarz/actions";
import { Button } from "@/components/ui/Button";
import { warsawTodayIso } from "@/lib/datetime";

const WEEKDAY_LONG = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
] as const;

export function GroupDetailView({ data }: { data: AdminGroupDetail }) {
  return (
    <ToastProvider>
      <GroupDetailInner data={data} />
    </ToastProvider>
  );
}

function GroupDetailInner({ data }: { data: AdminGroupDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const city =
    site.locations.find((item) => item.id === data.locationId)?.city ??
    data.locationId;
  const weekday =
    data.weekday >= 1 && data.weekday <= 7
      ? WEEKDAY_LONG[data.weekday - 1]
      : "";

  async function runConfirm(bookingId: string) {
    setPending(true);
    const result = await confirmBooking({ bookingId });
    setPending(false);
    if (result.ok) {
      toast.push("ok", "Zapisane.");
      router.refresh();
    } else {
      toast.push("err", result.error);
    }
  }

  async function runCancel(bookingId: string) {
    setPending(true);
    const result = await cancelBooking({ bookingId });
    setPending(false);
    if (result.ok) {
      toast.push("ok", "Zapisane.");
      router.refresh();
    } else {
      toast.push("err", result.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[12px] text-muted">{city}</p>
        <h1 className="text-2xl font-semibold text-cream">{data.name}</h1>
        <p className="mt-1 text-[14px] text-muted">
          {weekday} {data.startTime.slice(0, 5)}
          {data.level ? ` · ${data.level}` : ""}
          {` · ${data.taken}/${data.capacity}`}
        </p>
        <Button
          href={`/admin/ewidencja?grupa=${data.id}&data=${warsawTodayIso()}`}
          variant="outline"
          size="sm"
          className="mt-3"
        >
          Dziennik zajęć
        </Button>
      </div>

      <GroupMembersList
        classId={data.id}
        locationId={data.locationId}
        classSlug={data.slug}
        durationMin={data.durationMin}
        members={data.members}
        bookings={data.bookings}
        pending={pending}
        showFullLink={false}
        onConfirm={(booking) => void runConfirm(booking.id)}
        onCancel={(booking) => void runCancel(booking.id)}
        onPaymentDone={(message) => {
          toast.push("ok", message);
          router.refresh();
        }}
        onPaymentError={(message) => toast.push("err", message)}
      />

      <Button href="/admin/kalendarz" variant="ghost" size="sm">
        Wróć do kalendarza
      </Button>
    </div>
  );
}
