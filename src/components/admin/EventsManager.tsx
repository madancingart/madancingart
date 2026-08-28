"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EventForm, type EventFormValues } from "@/components/admin/EventForm";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import { Button } from "@/components/ui/Button";
import { formatBookingWhen, nowInWarsaw, toWarsaw } from "@/lib/datetime";
import { locationLabel } from "@/lib/admin/booking-labels";
import { deleteEvent } from "@/app/admin/(app)/eventy/actions";
import type { LocationId } from "@/content/site";

export type AdminEventListItem = {
  id: string;
  title: string;
  description: string | null;
  locationId: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  signupOpen: boolean;
  published: boolean;
  taken: number;
};

function toForm(item: AdminEventListItem): EventFormValues {
  const start = toWarsaw(item.startsAt);
  const end = toWarsaw(item.endsAt);
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    locationId: (item.locationId as LocationId | null) ?? "",
    date,
    startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
    endTime: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
    capacity: item.capacity ? String(item.capacity) : "",
    signupOpen: item.signupOpen,
    published: item.published,
  };
}

function emptyForm(): EventFormValues {
  const now = nowInWarsaw();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    title: "",
    description: "",
    locationId: "",
    date,
    startTime: "18:00",
    endTime: "20:00",
    capacity: "",
    signupOpen: true,
    published: true,
  };
}

export function EventsManager({ events }: { events: AdminEventListItem[] }) {
  return (
    <ToastProvider>
      <EventsManagerInner events={events} />
    </ToastProvider>
  );
}

function EventsManagerInner({ events }: { events: AdminEventListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const openNew = searchParams.get("nowy") === "1";
  const editId = searchParams.get("id");
  const [creating, setCreating] = useState(openNew);
  const editing = useMemo(
    () => events.find((item) => item.id === editId) ?? null,
    [events, editId],
  );
  const [pending, setPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function closeForm() {
    setCreating(false);
    router.replace("/admin/eventy");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[15px] font-semibold text-cream">Eventy</h1>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setCreating(true);
            router.replace("/admin/eventy?nowy=1");
          }}
        >
          Dodaj event
        </Button>
      </div>

      {creating && !editing ? (
        <div className="mt-4">
          <EventForm
            initial={emptyForm()}
            onCancel={closeForm}
            onDone={(result) => {
              if (result.ok) {
                toast.push("ok", "Wydarzenie zapisane.");
              } else {
                toast.push("err", result.error);
              }
            }}
          />
        </div>
      ) : null}

      {editing ? (
        <div className="mt-4">
          <EventForm
            initial={toForm(editing)}
            onCancel={closeForm}
            onDone={(result) => {
              if (result.ok) {
                toast.push("ok", "Wydarzenie zapisane.");
              } else {
                toast.push("err", result.error);
              }
            }}
          />
        </div>
      ) : null}

      <ul className="mt-6 divide-y divide-white/10 border border-white/10">
        {events.length === 0 ? (
          <li className="p-4 text-muted">Brak wydarzeń.</li>
        ) : (
          events.map((item) => {
            const start = toWarsaw(item.startsAt);
            const end = toWarsaw(item.endsAt);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between"
              >
                <div>
                  <p className="text-cream">{item.title}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {formatBookingWhen(start, end)} ·{" "}
                    {locationLabel(item.locationId)}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    {item.published ? "opublikowany" : "szkic"} ·{" "}
                    {item.signupOpen ? "zapisy otwarte" : "zapisy zamknięte"} ·{" "}
                    {item.taken}
                    {item.capacity ? `/${item.capacity}` : " zapisanych"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    href={`/admin/eventy?id=${item.id}`}
                  >
                    Edytuj
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setDeleteId(item.id)}
                  >
                    Usuń
                  </Button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {deleteId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(100%,24rem)] border border-white/10 bg-black-soft p-5">
            <h2 className="text-[16px] font-semibold text-cream">
              Usunąć wydarzenie?
            </h2>
            <p className="mt-2 text-[14px] text-muted">
              Można usunąć tylko event bez zapisów.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteId(null)}
              >
                Wróć
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  void deleteEvent({ eventId: deleteId }).then((result) => {
                    setPending(false);
                    setDeleteId(null);
                    if (result.ok) {
                      toast.push("ok", "Usunięto.");
                      router.refresh();
                    } else {
                      toast.push("err", result.error);
                    }
                  });
                }}
              >
                Usuń
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
