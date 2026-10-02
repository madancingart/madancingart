"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClassPriceField } from "@/components/admin/ClassPriceField";
import { GroupMembersList } from "@/components/admin/GroupMembersList";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import type { AdminGroupDetail } from "@/lib/admin/calendar-types";
import { site } from "@/content/site";
import { updateClassSettings } from "@/app/admin/(app)/kalendarz/actions";
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

  async function savePrice(priceItemId: string) {
    setPending(true);
    const result = await updateClassSettings({
      classId: data.id,
      signupOpen: data.signupOpen,
      capacity: data.capacity,
      trainerId: data.trainerId ?? "",
      priceItemId,
    });
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
        <div className="mt-4 max-w-xl">
          <ClassPriceField
            locationId={data.locationId}
            value={data.priceItemId}
            disabled={pending}
            onChange={(priceItemId) => void savePrice(priceItemId)}
          />
        </div>
      </div>

      <GroupMembersList
        classId={data.id}
        members={data.members}
        showFullLink={false}
      />

      <Button href="/admin/kalendarz" variant="ghost" size="sm">
        Wróć do kalendarza
      </Button>
    </div>
  );
}
