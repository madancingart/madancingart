"use client";

import { useEffect, useMemo, useState } from "react";
import { addWeeks } from "date-fns";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDateTimeWarsaw, formatWeekRange, weekDaysFromIso } from "@/lib/datetime";
import type { AdminTrainer } from "@/lib/admin/calendar-types";
import type { LocationId } from "@/content/site";
import { site } from "@/content/site";
import { listOpenSlots, type OpenSlotOption } from "@/app/admin/(app)/pakiety/actions";
import { moveBooking } from "@/app/admin/(app)/kalendarz/actions";
import { trainerShortName } from "@/lib/trainers";

type MoveBookingModalProps = {
  bookingId: string;
  fromStartsAt: string;
  fromLocationId: string;
  fromTrainerId: string | null;
  trainers: AdminTrainer[];
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
};

export function MoveBookingModal({
  bookingId,
  fromStartsAt,
  fromLocationId,
  fromTrainerId,
  trainers,
  onClose,
  onDone,
  onError,
}: MoveBookingModalProps) {
  const defaultLocation =
    fromLocationId === "mikolow" || fromLocationId === "lubliniec"
      ? fromLocationId
      : "";
  const [locationId, setLocationId] = useState<LocationId | "">(defaultLocation);
  const [trainerId, setTrainerId] = useState(fromTrainerId ?? "");
  const [weekOf, setWeekOf] = useState(fromStartsAt);
  const [slots, setSlots] = useState<OpenSlotOption[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filters = useMemo(
    () => ({
      locationId: locationId || undefined,
      trainerId: trainerId || undefined,
      weekOf,
    }),
    [locationId, trainerId, weekOf],
  );
  const filterKey = JSON.stringify(filters);
  const loading = loadedFor !== filterKey;
  const weekDays = weekDaysFromIso(weekOf, 0);
  const weekLabel = formatWeekRange(weekDays[0], weekDays[6]);
  const selected = slots.find((item) => item.id === selectedId) ?? null;
  const fromLabel = `${formatDateTimeWarsaw(fromStartsAt)} · ${
    site.locations.find((item) => item.id === fromLocationId)?.city ??
    fromLocationId
  }`;

  useEffect(() => {
    let cancelled = false;
    void listOpenSlots(filters).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setSlots(result.slots);
        setListError(null);
      } else {
        setSlots([]);
        setListError(result.error);
      }
      setSelectedId(null);
      setLoadedFor(filterKey);
    });
    return () => {
      cancelled = true;
    };
  }, [filters, filterKey]);

  async function submit() {
    if (!selected) {
      onError("Wybierz wolny termin.");
      return;
    }
    setPending(true);
    const result = await moveBooking({
      bookingId,
      newSlotId: selected.id,
    });
    setPending(false);
    if (result.ok) {
      onDone(result.message ?? "Przeniesiono termin.");
    } else {
      onError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-white/10 bg-black p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-cream">
            Przenieś na inny termin
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

        <p className="mt-3 text-[13px] text-muted">Z: {fromLabel}</p>

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

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              setWeekOf(addWeeks(new Date(weekOf), -1).toISOString())
            }
          >
            Poprzedni tydzień
          </Button>
          <p className="text-center text-[13px] text-cream">{weekLabel}</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              setWeekOf(addWeeks(new Date(weekOf), 1).toISOString())
            }
          >
            Następny tydzień
          </Button>
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-[13px] text-muted">Ładowanie terminów…</p>
          ) : listError ? (
            <p className="text-[13px] text-muted">{listError}</p>
          ) : slots.length === 0 ? (
            <p className="text-[13px] text-muted">
              Brak wolnych slotów w tym tygodniu.
            </p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {slots.map((slot) => (
                <li key={slot.id}>
                  <label className="flex min-h-11 items-center gap-2 border border-white/10 px-3 text-[13px] text-cream">
                    <input
                      type="radio"
                      name="move-slot"
                      checked={selectedId === slot.id}
                      onChange={() => setSelectedId(slot.id)}
                    />
                    <span>
                      {formatDateTimeWarsaw(slot.startsAt)} · {slot.locationLabel}
                      {slot.trainerId
                        ? ` · ${trainerShortName(slot.trainerId) ?? ""}`
                        : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <p className="mt-4 border border-gold/40 bg-gold/10 p-3 text-[13px] text-cream">
            z {fromLabel}
            <br />
            na {formatDateTimeWarsaw(selected.startsAt)} · {selected.locationLabel}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Wróć
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || !selected}
            onClick={() => void submit()}
          >
            Przenieś
          </Button>
        </div>
      </div>
    </div>
  );
}
