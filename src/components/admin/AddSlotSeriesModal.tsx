"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TrainerSelect } from "@/components/admin/TrainerSelect";
import { cn } from "@/lib/cn";
import { site, type LocationId } from "@/content/site";
import { TZDate } from "@date-fns/tz";
import { formatDayChip, nowInWarsaw, WARSAW_TZ } from "@/lib/datetime";
import {
  addIsoDays,
  addMonthsIso,
  applyCollisions,
  generateSlotSeries,
  isWithinMaxRange,
  occupiedFromClasses,
  occupiedFromTrainerSlots,
  polishCreateSlotsLabel,
  type SeriesPreviewSlot,
  type SeriesWindow,
} from "@/lib/slot-series";
import {
  createSlotSeries,
  getSlotSeriesOccupancy,
  type ActionResult,
  type SlotSeriesOccupancy,
} from "@/app/admin/(app)/kalendarz/actions";
import type { TrainerRow } from "@/lib/types";

const DURATION_PRESETS = [45, 50, 60, 90] as const;
const BREAK_PRESETS = [0, 5, 10, 15] as const;
const WEEKDAYS: { id: number; label: string }[] = [
  { id: 1, label: "Pn" },
  { id: 2, label: "Wt" },
  { id: 3, label: "Śr" },
  { id: 4, label: "Cz" },
  { id: 5, label: "Pt" },
  { id: 6, label: "So" },
  { id: 7, label: "Nd" },
];

type AddSlotSeriesModalProps = {
  open: boolean;
  locationId: LocationId;
  trainers: Pick<TrainerRow, "id" | "name">[];
  onClose: () => void;
  onDone: (result: ActionResult) => void;
};

function warsawIsoDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromIso(iso: string): TZDate {
  const [year, month, day] = iso.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new TZDate(year, month - 1, day, 12, 0, WARSAW_TZ);
}

export function AddSlotSeriesModal({
  open,
  locationId,
  trainers,
  onClose,
  onDone,
}: AddSlotSeriesModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (open && !node.open) {
      node.showModal();
    }
    if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="series-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      {open ? (
        <AddSlotSeriesForm
          key={`${locationId}-series`}
          locationId={locationId}
          trainers={trainers}
          onClose={onClose}
          onDone={onDone}
        />
      ) : null}
    </dialog>
  );
}

function AddSlotSeriesForm({
  locationId: initialLocationId,
  trainers,
  onClose,
  onDone,
}: Omit<AddSlotSeriesModalProps, "open">) {
  const today = warsawIsoDate(nowInWarsaw());
  const [locationId, setLocationId] = useState<LocationId>(initialLocationId);
  const [trainerId, setTrainerId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(addIsoDays(today, 13));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [windows, setWindows] = useState<SeriesWindow[]>([
    { start: "10:00", end: "14:00" },
  ]);
  const [durationMin, setDurationMin] = useState(60);
  const [customDuration, setCustomDuration] = useState(false);
  const [breakMin, setBreakMin] = useState<(typeof BREAK_PRESETS)[number]>(0);
  const [occupancy, setOccupancy] = useState<SlotSeriesOccupancy>({
    trainerSlots: [],
    classes: [],
  });
  const [occupancyError, setOccupancyError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const maxTo = addMonthsIso(fromDate, 3);
  const rangeOk = isWithinMaxRange(fromDate, toDate);

  const generated = useMemo(
    () =>
      rangeOk
        ? generateSlotSeries({
            fromDate,
            toDate,
            weekdays,
            windows,
            durationMin,
            breakMin,
          })
        : [],
    [rangeOk, fromDate, toDate, weekdays, windows, durationMin, breakMin],
  );

  const preview = useMemo(
    () =>
      applyCollisions(generated, [
        ...occupiedFromClasses(occupancy.classes, fromDate, toDate),
        ...occupiedFromTrainerSlots(occupancy.trainerSlots),
      ]),
    [generated, occupancy, fromDate, toDate],
  );

  const previewSignature = preview
    .map((slot) => `${slot.key}:${slot.conflict ?? ""}`)
    .join("|");

  useEffect(() => {
    setChecked(
      new Set(
        preview.filter((slot) => slot.conflict === null).map((slot) => slot.key),
      ),
    );
  }, [previewSignature, preview]);

  useEffect(() => {
    if (toDate > maxTo) {
      setToDate(maxTo);
    } else if (toDate < fromDate) {
      setToDate(fromDate);
    }
  }, [fromDate, maxTo, toDate]);

  useEffect(() => {
    let cancelled = false;
    setOccupancyError(null);
    void getSlotSeriesOccupancy({
      locationId,
      trainerId: trainerId || undefined,
      fromDate,
      toDate,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setOccupancy({ trainerSlots: [], classes: [] });
        setOccupancyError(result.error);
        return;
      }
      setOccupancy(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, trainerId, fromDate, toDate]);

  const groups = useMemo(() => {
    const map = new Map<string, SeriesPreviewSlot[]>();
    for (const slot of preview) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    return [...map.entries()];
  }, [preview]);

  const selectedCount = preview.filter(
    (slot) => slot.conflict === null && checked.has(slot.key),
  ).length;

  function toggleWeekday(id: number) {
    setWeekdays((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].sort((left, right) => left - right),
    );
  }

  function updateWindow(index: number, patch: Partial<SeriesWindow>) {
    setWindows((current) =>
      current.map((window, windowIndex) =>
        windowIndex === index ? { ...window, ...patch } : window,
      ),
    );
  }

  async function submit() {
    if (!trainerId || selectedCount === 0) {
      return;
    }
    setPending(true);
    const selected = preview
      .filter((slot) => slot.conflict === null && checked.has(slot.key))
      .map((slot) => ({ date: slot.date, start: slot.start }));
    const result = await createSlotSeries({
      locationId,
      trainerId,
      fromDate,
      toDate,
      weekdays,
      windows: windows.map((window) => ({
        start: window.start.slice(0, 5),
        end: window.end.slice(0, 5),
      })),
      durationMin,
      breakMin,
      selected,
    });
    setPending(false);
    onDone(result);
    if (result.ok) {
      onClose();
    }
  }

  return (
    <div className="flex max-h-[min(92vh,46rem)] w-[min(100vw-1.25rem,68rem)] flex-col border border-white/10 bg-black-soft">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-cream">
            Dodaj serię terminów
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Ułóż okna i dni — po prawej odhaczysz, czego nie chcesz tworzyć.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center text-cream"
          aria-label="Zamknij"
        >
          <X strokeWidth={1.5} className="size-5" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto border-white/10 px-5 py-4 lg:border-r">
          <label className="block text-[13px] text-muted">
            Lokalizacja
            <select
              value={locationId}
              onChange={(event) =>
                setLocationId(event.target.value as LocationId)
              }
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            >
              {site.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.city}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-[13px] text-muted">
            Prowadzący
            <TrainerSelect
              value={trainerId}
              trainers={trainers}
              required
              disabled={pending}
              onChange={setTrainerId}
            />
          </label>

          <fieldset className="mt-4">
            <legend className="text-[13px] text-muted">Zakres dat</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[12px] text-muted">
                Od
                <input
                  type="date"
                  value={fromDate}
                  min={today}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="mt-1 min-h-11 w-full border border-white/10 bg-black px-2 text-cream"
                />
              </label>
              <label className="text-[12px] text-muted">
                Do
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={maxTo}
                  onChange={(event) => setToDate(event.target.value)}
                  className="mt-1 min-h-11 w-full border border-white/10 bg-black px-2 text-cream"
                />
              </label>
            </div>
            <p className="mt-1 text-[12px] text-muted">Maksymalnie 3 miesiące.</p>
            {!rangeOk ? (
              <p className="mt-1 text-[12px] text-gold">Skróć zakres dat.</p>
            ) : null}
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-[13px] text-muted">Dni tygodnia</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const active = weekdays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleWeekday(day.id)}
                    className={cn(
                      "min-h-11 min-w-11 rounded-full border px-3 text-[13px]",
                      active
                        ? "border-gold bg-gold text-black"
                        : "border-white/20 text-cream",
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-[13px] text-muted">Okna czasowe</legend>
            <div className="mt-2 flex flex-col gap-2">
              {windows.map((window, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={window.start}
                    aria-label={`Początek okna ${index + 1}`}
                    onChange={(event) =>
                      updateWindow(index, {
                        start: event.target.value.slice(0, 5),
                      })
                    }
                    className="min-h-11 flex-1 border border-white/10 bg-black px-2 text-cream"
                  />
                  <span className="text-[12px] text-muted">do</span>
                  <input
                    type="time"
                    value={window.end}
                    aria-label={`Koniec okna ${index + 1}`}
                    onChange={(event) =>
                      updateWindow(index, {
                        end: event.target.value.slice(0, 5),
                      })
                    }
                    className="min-h-11 flex-1 border border-white/10 bg-black px-2 text-cream"
                  />
                  {windows.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Usuń okno ${index + 1}`}
                      onClick={() =>
                        setWindows((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="flex size-11 shrink-0 items-center justify-center text-muted hover:text-cream"
                    >
                      <X strokeWidth={1.5} className="size-4" />
                    </button>
                  ) : (
                    <span className="size-11 shrink-0" />
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setWindows((current) => [
                  ...current,
                  current.length === 1
                    ? { start: "16:00", end: "21:00" }
                    : { start: "18:00", end: "21:00" },
                ])
              }
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] text-gold hover:text-gold-light"
            >
              <Plus strokeWidth={1.5} className="size-4" />
              Dodaj okno
            </button>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-[13px] text-muted">Długość slotu</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => {
                    setCustomDuration(false);
                    setDurationMin(minutes);
                  }}
                  className={cn(
                    "min-h-11 border px-3 text-[13px]",
                    !customDuration && durationMin === minutes
                      ? "border-gold text-gold"
                      : "border-white/10 text-cream",
                  )}
                >
                  {minutes} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomDuration(true)}
                className={cn(
                  "min-h-11 border px-3 text-[13px]",
                  customDuration
                    ? "border-gold text-gold"
                    : "border-white/10 text-cream",
                )}
              >
                Własna
              </button>
            </div>
            {customDuration ? (
              <input
                type="number"
                min={15}
                max={180}
                value={durationMin}
                onChange={(event) =>
                  setDurationMin(Number.parseInt(event.target.value, 10) || 15)
                }
                className="mt-2 min-h-11 w-24 border border-white/10 bg-black px-3 text-cream"
                aria-label="Długość slotu w minutach"
              />
            ) : null}
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-[13px] text-muted">
              Przerwa między slotami
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {BREAK_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setBreakMin(minutes)}
                  className={cn(
                    "min-h-11 border px-3 text-[13px]",
                    breakMin === minutes
                      ? "border-gold text-gold"
                      : "border-white/10 text-cream",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden px-5 py-4">
          <p className="text-[13px] text-muted">
            Podgląd
            {occupancyError ? ` · ${occupancyError}` : ""}
          </p>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            {groups.length === 0 ? (
              <p className="text-[13px] text-muted">
                Wybierz dni i okna, aby zobaczyć listę terminów.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {groups.map(([date, slots]) => (
                  <section key={date}>
                    <h3 className="text-[13px] font-semibold text-cream">
                      {formatDayChip(dateFromIso(date))}
                    </h3>
                    <ul className="mt-2 flex flex-col gap-1">
                      {slots.map((slot) => {
                        const blocked = Boolean(slot.conflict);
                        const on = !blocked && checked.has(slot.key);
                        return (
                          <li key={slot.key}>
                            <label
                              className={cn(
                                "flex min-h-11 items-center gap-3 border px-3 text-[13px]",
                                blocked
                                  ? "border-white/5 text-muted"
                                  : on
                                    ? "border-white/10 bg-black text-cream"
                                    : "border-white/10 text-muted",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="size-4 accent-[#C9962E]"
                                disabled={blocked}
                                checked={on}
                                onChange={() => {
                                  if (blocked) {
                                    return;
                                  }
                                  setChecked((current) => {
                                    const next = new Set(current);
                                    if (next.has(slot.key)) {
                                      next.delete(slot.key);
                                    } else {
                                      next.add(slot.key);
                                    }
                                    return next;
                                  });
                                }}
                              />
                              <span className="tabular-nums">
                                {slot.start}–{slot.end}
                              </span>
                              {slot.conflict ? (
                                <span className="ml-auto truncate text-[12px]">
                                  {slot.conflict}
                                </span>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={onClose}
        >
          Anuluj
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending || !trainerId || selectedCount === 0 || !rangeOk}
          onClick={() => void submit()}
        >
          {polishCreateSlotsLabel(selectedCount)}
        </Button>
      </div>
    </div>
  );
}
