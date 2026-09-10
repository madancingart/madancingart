"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cancelClassSession } from "@/app/admin/(app)/ewidencja/actions";

export function CancelClassOccurrenceForm({
  classId,
  sessionDate,
  onDone,
  onError,
}: {
  classId: string;
  sessionDate: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[13px] text-muted hover:text-gold"
      >
        Odwołaj te zajęcia
      </button>
    );
  }

  return (
    <form
      className="border border-white/10 bg-black-soft p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void cancelClassSession({
          classId,
          sessionDate,
          reason: reason.trim() || undefined,
        }).then((result) => {
          setPending(false);
          if (result.ok) {
            setOpen(false);
            setReason("");
            onDone(result.message);
          } else {
            onError(result.error);
          }
        });
      }}
    >
      <label className="text-[12px] text-muted">
        Powód odwołania (opcjonalnie)
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          className="mt-1 min-h-20 w-full border border-white/10 bg-black px-3 py-2 text-[13px] text-cream"
        />
      </label>
      <p className="mt-2 text-[12px] text-muted">
        Wyślemy wiadomość do zapisanych osób z informacją o odrobieniu.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Odwołaj i powiadom
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Anuluj
        </Button>
      </div>
    </form>
  );
}
