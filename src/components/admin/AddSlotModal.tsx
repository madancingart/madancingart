"use client";

import { useEffect, useRef, useState } from "react";
import { addMinutes } from "date-fns";
import { Button } from "@/components/ui/Button";
import { fromDatetimeLocal, nowInWarsaw, toDatetimeLocalValue } from "@/lib/datetime";
import type { LocationId } from "@/content/site";
import { addOpenSlots } from "@/app/admin/(app)/kalendarz/actions";
import type { ActionResult } from "@/app/admin/(app)/kalendarz/actions";
import { TrainerSelect } from "@/components/admin/TrainerSelect";
import type { TrainerRow } from "@/lib/types";

const PRESETS = [45, 50, 60, 90] as const;

type AddSlotModalProps = {
  open: boolean;
  locationId: LocationId;
  trainers: Pick<TrainerRow, "id" | "name">[];
  initialStart: Date | null;
  onClose: () => void;
  onDone: (result: ActionResult) => void;
};

export function AddSlotModal({
  open,
  locationId,
  trainers,
  initialStart,
  onClose,
  onDone,
}: AddSlotModalProps) {
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
      className="confirm-dialog"
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
        <AddSlotForm
          key={toDatetimeLocalValue(initialStart ?? nowInWarsaw())}
          locationId={locationId}
          trainers={trainers}
          initialStart={initialStart}
          onClose={onClose}
          onDone={onDone}
        />
      ) : null}
    </dialog>
  );
}

function AddSlotForm({
  locationId,
  trainers,
  initialStart,
  onClose,
  onDone,
}: Omit<AddSlotModalProps, "open">) {
  const [startsAt, setStartsAt] = useState(() =>
    toDatetimeLocalValue(initialStart ?? nowInWarsaw()),
  );
  const [durationMin, setDurationMin] = useState(60);
  const [customDuration, setCustomDuration] = useState(false);
  const [weeks, setWeeks] = useState(1);
  const [trainerId, setTrainerId] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const result = await addOpenSlots({
      locationId,
      startsAt,
      durationMin,
      weeks,
      trainerId,
    });
    setPending(false);
    onDone(result);
    if (result.ok) {
      onClose();
    }
  }

  const start = startsAt ? fromDatetimeLocal(startsAt) : null;
  const end = start ? addMinutes(start, durationMin) : null;

  return (
    <div className="w-[min(100vw-2rem,26rem)] border border-white/10 bg-black-soft p-5">
      <h2 className="text-[16px] font-semibold text-cream">Dodaj wolny termin</h2>
      <p className="mt-1 text-[13px] text-muted">
        Czas w strefie Europe/Warsaw. Przycisk otwiera zapisy od razu.
      </p>

      <label className="mt-4 block text-[13px] text-muted">
        Data i godzina startu (Europe/Warsaw)
        <span className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            type="date"
            value={startsAt.slice(0, 10)}
            onChange={(event) =>
              setStartsAt(
                `${event.target.value}T${startsAt.slice(11, 16) || "16:00"}`,
              )
            }
            className="min-h-11 flex-1 border border-white/10 bg-black px-3 text-cream"
          />
          <input
            type="time"
            value={startsAt.slice(11, 16)}
            onChange={(event) =>
              setStartsAt(`${startsAt.slice(0, 10)}T${event.target.value}`)
            }
            className="min-h-11 border border-white/10 bg-black px-3 text-cream"
          />
        </span>
      </label>

      <fieldset className="mt-4">
        <legend className="text-[13px] text-muted">Czas trwania</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => {
                setCustomDuration(false);
                setDurationMin(minutes);
              }}
              className={`min-h-11 border px-3 text-[13px] ${
                !customDuration && durationMin === minutes
                  ? "border-gold text-gold"
                  : "border-white/10 text-cream"
              }`}
            >
              {minutes} min
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomDuration(true)}
            className={`min-h-11 border px-3 text-[13px] ${
              customDuration
                ? "border-gold text-gold"
                : "border-white/10 text-cream"
            }`}
          >
            Własny
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
            aria-label="Czas trwania w minutach"
          />
        ) : null}
      </fieldset>

      {start && end ? (
        <p className="mt-3 text-[13px] text-muted">
          {toDatetimeLocalValue(start).replace("T", " ")} → koniec{" "}
          {toDatetimeLocalValue(end).slice(11)}
        </p>
      ) : null}

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

      <label className="mt-4 block text-[13px] text-muted">
        Powtórz przez N tygodni
        <input
          type="number"
          min={1}
          max={12}
          value={weeks}
          onChange={(event) =>
            setWeeks(Number.parseInt(event.target.value, 10) || 1)
          }
          className="mt-1 min-h-11 w-24 border border-white/10 bg-black px-3 text-cream"
        />
      </label>
      <p className="mt-1 text-[12px] text-muted">
        1 = tylko ten termin. 4 = ten i trzy kolejne tygodnie o tej samej
        godzinie.
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={onClose}
        >
          Anuluj
        </Button>
        <Button type="button" size="sm" disabled={pending || !trainerId} onClick={submit}>
          Dodaj i otwórz zapisy
        </Button>
      </div>
    </div>
  );
}
