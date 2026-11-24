"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ClassPriceField } from "@/components/admin/ClassPriceField";
import { TrainerSelect } from "@/components/admin/TrainerSelect";
import { Button } from "@/components/ui/Button";
import { saveRecurringClass } from "@/app/admin/(app)/kalendarz/actions";
import type { ActionResult } from "@/app/admin/(app)/kalendarz/actions";
import type { AdminClassType, AdminTrainer } from "@/lib/admin/calendar-types";
import type { LocationId } from "@/content/site";

const WEEKDAYS = [
  { value: 1, label: "Poniedziałek" },
  { value: 2, label: "Wtorek" },
  { value: 3, label: "Środa" },
  { value: 4, label: "Czwartek" },
  { value: 5, label: "Piątek" },
  { value: 6, label: "Sobota" },
  { value: 7, label: "Niedziela" },
];

type AddClassModalProps = {
  open: boolean;
  locationId: LocationId;
  classTypes: AdminClassType[];
  trainers: AdminTrainer[];
  onClose: () => void;
  onDone: (result: ActionResult) => void;
};

export function AddClassModal({
  open,
  locationId,
  classTypes,
  trainers,
  onClose,
  onDone,
}: AddClassModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [classTypeId, setClassTypeId] = useState(classTypes[0]?.id ?? "");
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("18:00");
  const [durationMin, setDurationMin] = useState(60);
  const [level, setLevel] = useState("");
  const [capacity, setCapacity] = useState(12);
  const [trainerId, setTrainerId] = useState("");
  const [priceItemId, setPriceItemId] = useState("");
  const [signupOpen, setSignupOpen] = useState(true);
  const [freeSignup, setFreeSignup] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (open && !classTypeId && classTypes[0]) {
      setClassTypeId(classTypes[0].id);
    }
  }, [open, classTypeId, classTypes]);

  async function submit() {
    setPending(true);
    const result = await saveRecurringClass({
      locationId,
      classTypeId,
      weekday,
      startTime,
      durationMin,
      level,
      capacity,
      signupOpen,
      freeSignup,
      active: true,
      trainerId,
      priceItemId: freeSignup ? "" : priceItemId,
    });
    setPending(false);
    onDone(result);
    if (result.ok) {
      onClose();
    }
  }

  return (
    <dialog
      ref={ref}
      className="admin-drawer"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !pending) onClose();
      }}
    >
      <div className="flex h-full w-[min(100vw,28rem)] flex-col border-l border-white/10 bg-black">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-[15px] font-semibold text-cream">Dodaj stałe zajęcia</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center text-cream"
            aria-label="Zamknij"
          >
            <X strokeWidth={1.5} className="size-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          <label className="text-[13px] text-muted">
            Typ zajęć
            <select
              value={classTypeId}
              onChange={(event) => setClassTypeId(event.target.value)}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            >
              {classTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] text-muted">
            Dzień tygodnia
            <select
              value={weekday}
              onChange={(event) => setWeekday(Number(event.target.value))}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            >
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[13px] text-muted">
              Godzina
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
              />
            </label>
            <label className="text-[13px] text-muted">
              Czas (min)
              <input
                type="number"
                min={15}
                max={180}
                value={durationMin}
                onChange={(event) =>
                  setDurationMin(Number.parseInt(event.target.value, 10) || 60)
                }
                className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
              />
            </label>
          </div>
          <label className="text-[13px] text-muted">
            Poziom (opcjonalnie)
            <input
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              placeholder="np. początkujący"
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            />
          </label>
          <label className="text-[13px] text-muted">
            Pojemność
            <input
              type="number"
              min={1}
              max={80}
              value={capacity}
              onChange={(event) =>
                setCapacity(Number.parseInt(event.target.value, 10) || 12)
              }
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            />
          </label>
          <label className="text-[13px] text-muted">
            Prowadzący
            <TrainerSelect
              value={trainerId}
              trainers={trainers}
              disabled={pending}
              onChange={setTrainerId}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-[13px] text-cream">
            <input
              type="checkbox"
              checked={freeSignup}
              onChange={(event) => setFreeSignup(event.target.checked)}
            />
            Zapis bez płatności (klient nie płaci przy zapisie)
          </label>
          {!freeSignup ? (
            <ClassPriceField
              locationId={locationId}
              value={priceItemId || null}
              disabled={pending}
              onChange={setPriceItemId}
            />
          ) : null}
          <label className="flex min-h-11 items-center gap-2 text-[13px] text-cream">
            <input
              type="checkbox"
              checked={signupOpen}
              onChange={(event) => setSignupOpen(event.target.checked)}
            />
            Zapisy otwarte od razu
          </label>
          <Button type="button" disabled={pending || !classTypeId} onClick={() => void submit()}>
            Dodaj do grafiku
          </Button>
        </div>
      </div>
    </dialog>
  );
}
