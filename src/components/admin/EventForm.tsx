"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { site, type LocationId } from "@/content/site";
import { saveEvent } from "@/app/admin/(app)/eventy/actions";
import type { ActionResult } from "@/app/admin/(app)/eventy/actions";

export type EventFormValues = {
  id?: string;
  title: string;
  description: string;
  locationId: LocationId | "";
  date: string;
  startTime: string;
  endTime: string;
  capacity: string;
  signupOpen: boolean;
  published: boolean;
};

type EventFormProps = {
  initial: EventFormValues;
  onDone: (result: ActionResult) => void;
  onCancel: () => void;
};

export function EventForm({ initial, onDone, onCancel }: EventFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const result = await saveEvent({
      id: values.id,
      title: values.title,
      description: values.description,
      locationId: values.locationId,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      capacity: values.capacity === "" ? "" : Number(values.capacity),
      signupOpen: values.signupOpen,
      published: values.published,
    });
    setPending(false);
    onDone(result);
    if (result.ok) {
      router.refresh();
      onCancel();
    }
  }

  const field = "mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream";

  return (
    <div className="border border-white/10 bg-black-soft p-4">
      <h2 className="text-[15px] font-semibold text-cream">
        {values.id ? "Edycja wydarzenia" : "Nowe wydarzenie"}
      </h2>

      <label className="mt-4 block text-[13px] text-muted">
        Tytuł
        <input
          value={values.title}
          onChange={(event) =>
            setValues((current) => ({ ...current, title: event.target.value }))
          }
          className={field}
        />
      </label>

      <label className="mt-3 block text-[13px] text-muted">
        Opis
        <textarea
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          rows={4}
          className="mt-1 w-full border border-white/10 bg-black px-3 py-2 text-cream"
        />
      </label>

      <label className="mt-3 block text-[13px] text-muted">
        Lokalizacja
        <select
          value={values.locationId}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              locationId: event.target.value as LocationId | "",
            }))
          }
          className={field}
        >
          <option value="">ogólne (obie sale)</option>
          {site.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.city}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-[13px] text-muted">
          Data (Warszawa)
          <input
            type="date"
            value={values.date}
            onChange={(event) =>
              setValues((current) => ({ ...current, date: event.target.value }))
            }
            className={field}
          />
        </label>
        <label className="text-[13px] text-muted">
          Od
          <input
            type="time"
            value={values.startTime}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                startTime: event.target.value,
              }))
            }
            className={field}
          />
        </label>
        <label className="text-[13px] text-muted">
          Do
          <input
            type="time"
            value={values.endTime}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                endTime: event.target.value,
              }))
            }
            className={field}
          />
        </label>
      </div>

      <label className="mt-3 block text-[13px] text-muted">
        Limit miejsc (puste = bez limitu)
        <input
          type="number"
          min={1}
          max={500}
          value={values.capacity}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              capacity: event.target.value,
            }))
          }
          className={field}
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-cream">
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={values.signupOpen}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                signupOpen: event.target.checked,
              }))
            }
          />
          Zapisy otwarte
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={values.published}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                published: event.target.checked,
              }))
            }
          />
          Opublikowany
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Anuluj
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={() => void submit()}>
          Zapisz
        </Button>
      </div>
    </div>
  );
}
