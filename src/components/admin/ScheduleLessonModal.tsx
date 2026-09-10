"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDateTimeWarsaw } from "@/lib/datetime";
import type { AdminTrainer } from "@/lib/admin/calendar-types";
import type { LocationId } from "@/content/site";
import { site } from "@/content/site";
import {
  listOpenSlots,
  schedulePackageLesson,
  type OpenSlotOption,
} from "@/app/admin/(app)/pakiety/actions";

type ScheduleLessonModalProps = {
  packageId: string;
  trainers: AdminTrainer[];
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
};

export function ScheduleLessonModal({
  packageId,
  trainers,
  onClose,
  onDone,
  onError,
}: ScheduleLessonModalProps) {
  const [locationId, setLocationId] = useState<LocationId | "">("");
  const [trainerId, setTrainerId] = useState("");
  const [slots, setSlots] = useState<OpenSlotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listOpenSlots({
      locationId: locationId || undefined,
      trainerId: trainerId || undefined,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result.ok) {
        setSlots(result.slots);
        setSelectedId(null);
      } else {
        onError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, trainerId, onError]);

  async function submit() {
    if (!selectedId) {
      onError("Wybierz wolny termin.");
      return;
    }
    setPending(true);
    const result = await schedulePackageLesson({
      packageId,
      slotId: selectedId,
    });
    setPending(false);
    if (result.ok) {
      onDone(result.message ?? "Zaplanowano lekcję.");
    } else {
      onError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-white/10 bg-black p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-cream">
            Zaplanuj lekcję
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center text-cream"
            aria-label="Zamknij"
          >
            <X strokeWidth={1.5} className="size-5" />
          </button>
        </div>

        <label className="mt-4 block text-[13px] text-muted">
          Sala
          <select
            value={locationId}
            onChange={(event) =>
              setLocationId(event.target.value as LocationId | "")
            }
            className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
          >
            <option value="">Wszystkie</option>
            {site.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.city}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-[13px] text-muted">
          Trener
          <select
            value={trainerId}
            disabled={pending}
            onChange={(event) => setTrainerId(event.target.value)}
            className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
          >
            <option value="">Wszyscy</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4">
          {loading ? (
            <p className="text-[13px] text-muted">Ładowanie terminów…</p>
          ) : slots.length === 0 ? (
            <p className="text-[13px] text-muted">
              Brak wolnych slotów w tym filtrze.
            </p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {slots.map((slot) => (
                <li key={slot.id}>
                  <label className="flex min-h-11 items-center gap-2 border border-white/10 px-3 text-[13px] text-cream">
                    <input
                      type="radio"
                      name="package-slot"
                      checked={selectedId === slot.id}
                      onChange={() => setSelectedId(slot.id)}
                    />
                    <span>
                      {formatDateTimeWarsaw(slot.startsAt)} · {slot.locationLabel}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Wróć
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || !selectedId}
            onClick={() => void submit()}
          >
            Zapisz na termin
          </Button>
        </div>
      </div>
    </div>
  );
}
